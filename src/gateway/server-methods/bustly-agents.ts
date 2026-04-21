import { readBustlyOAuthStateEnsuringFreshToken } from "../../bustly-oauth.js";
import { loadBustlyRemoteAgentMetadata } from "../../bustly/agent-presets.js";
import { scheduleBustlySessionTitleGeneration } from "../../bustly/session-title.js";
import { normalizeBustlyAgentName } from "../../bustly/workspace-agent.js";
import { getBustlySupabaseAuthConfigEnsuringFreshToken } from "../../bustly/supabase.js";
import {
  createBustlyWorkspaceAgent,
  createBustlyWorkspaceAgentSession,
  deleteBustlyWorkspaceAgent,
  listBustlyWorkspaceAgents,
  listBustlyWorkspaceAgentSessions,
  updateBustlyWorkspaceAgent,
} from "../../bustly/workspace-agents.js";
import { loadConfig } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

async function resolveWorkspaceIdParam(params: Record<string, unknown>): Promise<string> {
  const explicitWorkspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId.trim() : "";
  if (explicitWorkspaceId) {
    return explicitWorkspaceId;
  }
  const state = await readBustlyOAuthStateEnsuringFreshToken();
  return state?.user?.workspaceId?.trim() ?? "";
}

function shouldExposeBustlyHeartbeatMainSessions(env: NodeJS.ProcessEnv = process.env): boolean {
  const electronDev = env.OPENCLAW_ELECTRON_DEV?.trim().toLowerCase();
  if (electronDev === "1" || electronDev === "true") {
    return true;
  }
  const values = [env.OPENCLAW_PROFILE, env.OPENCLAW_ENV, env.NODE_ENV]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean);
  return values.includes("dev") || values.includes("development");
}

export const bustlyAgentsHandlers: GatewayRequestHandlers = {
  "bustly.agents.get-config": async ({ params, respond }) => {
    try {
      const rawSlug = typeof params.slug === "string" ? params.slug.trim() : "";
      if (!rawSlug) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "slug is required"));
        return;
      }
      const slug = normalizeBustlyAgentName(rawSlug);
      const metadata = await loadBustlyRemoteAgentMetadata(slug);
      respond(
        true,
        {
          slug,
          ...metadata,
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
  "bustly.agents.list": async ({ params, respond }) => {
    try {
      const workspaceId = await resolveWorkspaceIdParam(params);
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
      const workspaceId = await resolveWorkspaceIdParam(params);
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
      const workspaceId = await resolveWorkspaceIdParam(params);
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
      const workspaceId = await resolveWorkspaceIdParam(params);
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
  "bustly.sessions.list": async ({ params, respond }) => {
    try {
      const workspaceId = await resolveWorkspaceIdParam(params);
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
          includeHeartbeatMainSessions: shouldExposeBustlyHeartbeatMainSessions(),
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
  "bustly.sessions.create": async ({ params, respond, context }) => {
    try {
      const workspaceId = await resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const label = typeof params.label === "string" ? params.label.trim() : "";
      const promptExcerpt =
        typeof params.promptExcerpt === "string" ? params.promptExcerpt : undefined;
      const sampleRouteKey =
        typeof params.sampleRouteKey === "string" ? params.sampleRouteKey : undefined;
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
      scheduleBustlySessionTitleGeneration({
        workspaceId,
        agentId,
        sessionKey: created.sessionKey,
        sessionId: created.sessionId,
        seedLabel: created.name,
        promptExcerpt,
        sampleRouteKey,
        cfg: loadConfig(),
        onLabelUpdated: (payload) => {
          context.broadcast("bustly.session.label.updated", payload, { dropIfSlow: true });
        },
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
  "bustly.supabase.get-config": async ({ respond }) => {
    try {
      const config = await getBustlySupabaseAuthConfigEnsuringFreshToken();
      if (!config) {
        respond(true, null, undefined);
        return;
      }
      respond(true, config, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
};
