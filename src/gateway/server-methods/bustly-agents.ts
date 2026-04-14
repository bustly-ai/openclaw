import { readBustlyOAuthState } from "../../bustly-oauth.js";
import {
  createBustlyWorkspaceAgent,
  createBustlyWorkspaceAgentSession,
  deleteBustlyWorkspaceAgent,
  listBustlyWorkspaceAgents,
  listBustlyWorkspaceAgentSessions,
  updateBustlyWorkspaceAgent,
} from "../../bustly/workspace-agents.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function resolveWorkspaceIdParam(params: Record<string, unknown>): string {
  const explicitWorkspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId.trim() : "";
  if (explicitWorkspaceId) {
    return explicitWorkspaceId;
  }
  return readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
}

export const bustlyAgentsHandlers: GatewayRequestHandlers = {
  "bustly.agents.list": ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      if (!workspaceId) {
        respond(true, [], undefined);
        return;
      }
      respond(
        true,
        listBustlyWorkspaceAgents({
          workspaceId,
        }),
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.agents.create": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const name = typeof params.name === "string" ? params.name.trim() : "";
      const description =
        typeof params.description === "string" ? params.description.trim() : undefined;
      const icon = typeof params.icon === "string" ? params.icon.trim() : "";
      const skills = Array.isArray(params.skills)
        ? params.skills.map((skill) => String(skill).trim()).filter(Boolean)
        : params.skills === null
          ? null
          : undefined;
      const workspaceName =
        typeof params.workspaceName === "string" ? params.workspaceName.trim() : undefined;
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!name) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "name is required"));
        return;
      }
      const created = await createBustlyWorkspaceAgent({
        workspaceId,
        workspaceName,
        agentName: name,
        displayName: name,
        description,
        icon: icon || undefined,
        ...(skills !== undefined ? { skills } : {}),
      });
      respond(
        true,
        {
          workspaceId,
          agentId: created.agentId,
          workspaceDir: created.workspaceDir,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.agents.update": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const name = typeof params.name === "string" ? params.name.trim() : "";
      const identityMarkdown =
        typeof params.identityMarkdown === "string" ? params.identityMarkdown : undefined;
      const icon = typeof params.icon === "string" ? params.icon.trim() : "";
      const skills = Array.isArray(params.skills)
        ? params.skills.map((skill) => String(skill).trim()).filter(Boolean)
        : params.skills === null
          ? null
          : undefined;
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      await updateBustlyWorkspaceAgent({
        workspaceId,
        agentId,
        displayName: name || undefined,
        identityMarkdown,
        icon: icon || undefined,
        ...(skills !== undefined ? { skills } : {}),
      });
      respond(
        true,
        {
          ok: true,
          workspaceId,
          agentId,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.agents.delete": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      await deleteBustlyWorkspaceAgent({
        workspaceId,
        agentId,
      });
      respond(
        true,
        {
          ok: true,
          workspaceId,
          agentId,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.sessions.list": ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      respond(
        true,
        listBustlyWorkspaceAgentSessions({
          workspaceId,
          agentId,
        }),
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.sessions.create": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const label = typeof params.label === "string" ? params.label.trim() : "";
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      const created = await createBustlyWorkspaceAgentSession({
        workspaceId,
        agentId,
        label: label || undefined,
      });
      respond(
        true,
        {
          workspaceId,
          agentId: created.agentId,
          sessionKey: created.sessionKey,
          sessionId: created.sessionId,
          name: created.name,
          updatedAt: created.updatedAt,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.supabase.get-config": ({ respond }) => {
    try {
      const state = readBustlyOAuthState();
      const supabase = state?.supabase;
      const user = state?.user;
      const accessToken = user?.userAccessToken?.trim() || "";
      const workspaceId = user?.workspaceId?.trim() || "";
      if (!supabase?.url || !supabase.anonKey || !accessToken) {
        respond(true, null, undefined);
        return;
      }
      respond(
        true,
        {
          url: supabase.url,
          anonKey: supabase.anonKey,
          accessToken,
          workspaceId,
          userId: user?.userId || "",
          userEmail: user?.userEmail || "",
          userName: user?.userName || "",
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
};
