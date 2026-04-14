/**
 * OAuth request handlers for Bustly integration
 */

import { randomBytes } from "node:crypto";
import * as BustlyOAuth from "../../bustly-oauth.js";
import { resolveBustlyAccountWebBaseUrl } from "../../bustly/env.js";
import type { GatewayRequestHandler, GatewayRequestHandlerOptions } from "./types.js";

// In-memory OAuth state storage (for pending logins)
const pendingOAuthLogins = new Map<string, { expiresAt: number }>();
export const BUSTLY_OAUTH_CALLBACK_PATH = "/authorize";

/**
 * Get OAuth callback port from environment or default
 */
function getOAuthCallbackPort(): number {
  const port = process.env.BUSTLY_OAUTH_CALLBACK_PORT
    ? parseInt(process.env.BUSTLY_OAUTH_CALLBACK_PORT, 10)
    : 18790;
  return port;
}

/**
 * Generate a random trace ID for OAuth login
 */
function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

function resolvePublicRedirectUri(params: Record<string, unknown>): string {
  const candidates = [
    typeof params.publicOrigin === "string" ? params.publicOrigin.trim() : "",
    process.env.BUSTLY_OAUTH_PUBLIC_ORIGIN?.trim() ?? "",
  ];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.pathname = BUSTLY_OAUTH_CALLBACK_PATH;
        url.search = "";
        url.hash = "";
        return url.toString();
      }
    } catch {
      // Try the next candidate.
    }
  }
  return `http://127.0.0.1:${getOAuthCallbackPort()}${BUSTLY_OAUTH_CALLBACK_PATH}`;
}

/**
 * Initiate Bustly OAuth login flow
 */
export const oauthLogin: GatewayRequestHandler = async ({
  params,
  respond,
}: Pick<GatewayRequestHandlerOptions, "params" | "respond">) => {
  try {
    const clientId = process.env.BUSTLY_CLIENT_ID;

    if (!clientId) {
      respond(false, undefined, {
        code: "OAUTH_ERROR",
        message:
          "Bustly OAuth configuration not found. Please set Bustly account base URLs and BUSTLY_CLIENT_ID environment variables.",
      });
      return;
    }
    const webBaseUrl = resolveBustlyAccountWebBaseUrl();

    // Read current OAuth state to get device ID
    const currentState = BustlyOAuth.readBustlyOAuthState();
    const deviceId = currentState?.deviceId ?? generateTraceId();

    // Generate login trace ID
    const loginTraceId = generateTraceId();

    // Build OAuth login URL
    const redirectUri = resolvePublicRedirectUri(params);
    console.log("[BustlyOAuth] oauth.login redirect_uri:", redirectUri);
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      device_id: deviceId,
      login_trace_id: loginTraceId,
    });
    const loginUrl = `${webBaseUrl}/admin/auth?${query.toString()}`;

    // Store pending login state
    pendingOAuthLogins.set(loginTraceId, {
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    // Initialize OAuth state with login trace ID
    BustlyOAuth.initBustlyOAuthFlow();
    BustlyOAuth.updateBustlyOAuthState({ loginTraceId });

    respond(true, { loginUrl, loginTraceId }, undefined);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "OAUTH_ERROR",
      message: `Failed to initiate login: ${errorMsg}`,
    });
  }
};

/**
 * Poll for OAuth login completion
 */
export const oauthPoll: GatewayRequestHandler = async ({
  params,
  respond,
}: Pick<GatewayRequestHandlerOptions, "params" | "respond">) => {
  try {
    const loginTraceId = params?.loginTraceId as string | undefined;

    if (!loginTraceId) {
      respond(false, undefined, {
        code: "OAUTH_ERROR",
        message: "Missing loginTraceId parameter",
      });
      return;
    }

    // Check if pending login exists
    const pendingLogin = pendingOAuthLogins.get(loginTraceId);
    if (!pendingLogin) {
      // Login might have already completed, check current state
      const isLoggedIn = BustlyOAuth.isBustlyLoggedIn();
      respond(true, { pending: !isLoggedIn }, undefined);
      return;
    }

    // Check if login has expired
    if (Date.now() > pendingLogin.expiresAt) {
      pendingOAuthLogins.delete(loginTraceId);
      respond(false, undefined, {
        code: "OAUTH_ERROR",
        message: "Login session expired",
      });
      return;
    }

    // Check if user is now logged in
    const isLoggedIn = BustlyOAuth.isBustlyLoggedIn();

    // If logged in, clear pending state
    if (isLoggedIn) {
      pendingOAuthLogins.delete(loginTraceId);
    }

    respond(true, { pending: !isLoggedIn }, undefined);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "OAUTH_ERROR",
      message: `Failed to poll login status: ${errorMsg}`,
    });
  }
};

/**
 * Cancel pending OAuth login flow.
 */
export const oauthCancel: GatewayRequestHandler = async ({
  params,
  respond,
}: Pick<GatewayRequestHandlerOptions, "params" | "respond">) => {
  try {
    const loginTraceId = typeof params?.loginTraceId === "string" ? params.loginTraceId.trim() : "";
    if (loginTraceId) {
      pendingOAuthLogins.delete(loginTraceId);
      const state = BustlyOAuth.readBustlyOAuthState();
      if (state?.loginTraceId === loginTraceId) {
        BustlyOAuth.updateBustlyOAuthState({
          loginTraceId: undefined,
          authCode: undefined,
          expiresAt: undefined,
        });
      }
    } else {
      pendingOAuthLogins.clear();
      const state = BustlyOAuth.readBustlyOAuthState();
      if (state?.loginTraceId || state?.authCode || state?.expiresAt) {
        BustlyOAuth.updateBustlyOAuthState({
          loginTraceId: undefined,
          authCode: undefined,
          expiresAt: undefined,
        });
      }
    }

    respond(
      true,
      {
        canceled: true,
        loginTraceId: loginTraceId || null,
      },
      undefined,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "OAUTH_ERROR",
      message: `Failed to cancel login: ${errorMsg}`,
    });
  }
};

/**
 * Check if user is logged in to Bustly
 */
export const oauthIsLoggedIn: GatewayRequestHandler = async ({
  respond,
}: Pick<GatewayRequestHandlerOptions, "respond">) => {
  try {
    const loggedIn = BustlyOAuth.isBustlyLoggedIn();
    respond(true, { loggedIn }, undefined);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "OAUTH_ERROR",
      message: `Failed to check login status: ${errorMsg}`,
    });
  }
};

/**
 * Get current Bustly user info
 */
export const oauthGetUserInfo: GatewayRequestHandler = async ({
  respond,
}: Pick<GatewayRequestHandlerOptions, "respond">) => {
  try {
    const userInfo = BustlyOAuth.getBustlyUserInfo();
    respond(true, { user: userInfo }, undefined);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "OAUTH_ERROR",
      message: `Failed to get user info: ${errorMsg}`,
    });
  }
};

/**
 * Logout from Bustly
 */
export const oauthLogout: GatewayRequestHandler = async ({
  respond,
}: Pick<GatewayRequestHandlerOptions, "respond">) => {
  try {
    BustlyOAuth.logoutBustly();
    respond(true, { success: true }, undefined);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "OAUTH_ERROR",
      message: `Failed to logout: ${errorMsg}`,
    });
  }
};

export const oauthHandlers = {
  "oauth.login": oauthLogin,
  "oauth.poll": oauthPoll,
  "oauth.cancel": oauthCancel,
  "oauth.is-logged-in": oauthIsLoggedIn,
  "oauth.get-user-info": oauthGetUserInfo,
  "oauth.logout": oauthLogout,
};
