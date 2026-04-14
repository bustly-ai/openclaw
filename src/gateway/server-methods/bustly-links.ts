import { resolveBustlyAdminLink, type BustlyLinkKind } from "../../bustly/admin-links.js";
import {
  resolveBustlyAccountApiBaseUrl,
  resolveBustlyAccountWebBaseUrl,
} from "../../bustly/env.js";
import { loadConfig } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const VALID_BUSTLY_LINK_KINDS: ReadonlySet<BustlyLinkKind> = new Set([
  "settings",
  "workspace-settings",
  "workspace-invite",
  "workspace-manage",
  "workspace-pricing",
  "workspace-create",
]);

function resolveLinkKind(params: Record<string, unknown>): BustlyLinkKind | null {
  const kind = typeof params.kind === "string" ? params.kind.trim() : "";
  if (!kind || !VALID_BUSTLY_LINK_KINDS.has(kind as BustlyLinkKind)) {
    return null;
  }
  return kind as BustlyLinkKind;
}

function resolveWebBaseFromUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return undefined;
  }
}

function resolveBustlyLinkEnv(): NodeJS.ProcessEnv {
  try {
    const explicitWebBase = resolveBustlyAccountWebBaseUrl(process.env);
    return {
      ...process.env,
      BUSTLY_ACCOUNT_WEB_BASE_URL: explicitWebBase,
    };
  } catch {
    // Fall through to derived values.
  }

  try {
    const derivedFromAccountApiEnv = resolveWebBaseFromUrl(
      resolveBustlyAccountApiBaseUrl(process.env),
    );
    if (derivedFromAccountApiEnv) {
      return {
        ...process.env,
        BUSTLY_ACCOUNT_WEB_BASE_URL: derivedFromAccountApiEnv,
      };
    }
  } catch {
    // Fall through to derived values.
  }

  const derivedFromApiEnv = resolveWebBaseFromUrl(process.env.BUSTLY_API_BASE_URL);
  if (derivedFromApiEnv) {
    return {
      ...process.env,
      BUSTLY_WEB_BASE_URL: derivedFromApiEnv,
    };
  }

  try {
    const cfg = loadConfig();
    const provider = cfg.models?.providers?.bustly;
    const providerBase =
      provider && typeof provider === "object" && "baseUrl" in provider
        ? (provider.baseUrl as string | undefined)
        : undefined;
    const derivedFromProvider = resolveWebBaseFromUrl(providerBase);
    if (derivedFromProvider) {
      return {
        ...process.env,
        BUSTLY_WEB_BASE_URL: derivedFromProvider,
      };
    }
  } catch {
    // Ignore config read failures and fall through to default env.
  }

  return process.env;
}

export const bustlyLinksHandlers: GatewayRequestHandlers = {
  "bustly.links.resolve": ({ params, respond }) => {
    try {
      const kind = resolveLinkKind(params);
      if (!kind) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "kind is required (settings|workspace-settings|workspace-invite|workspace-manage|workspace-pricing|workspace-create)",
          ),
        );
        return;
      }

      const workspaceId =
        typeof params.workspaceId === "string" ? params.workspaceId.trim() : undefined;
      const url = resolveBustlyAdminLink({
        kind,
        workspaceId,
        env: resolveBustlyLinkEnv(),
      });
      respond(
        true,
        {
          kind,
          url,
        },
        undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("workspaceId is required")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },
};
