import { readBustlyOAuthState } from "../../bustly-oauth.js";
import {
  normalizeBustlyWorkspaceId,
  resolveBustlyWorkspaceTokenFromAgentId,
} from "../../bustly/workspace-agent.js";
import { DEFAULT_AGENT_ID, normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import type { CronJob } from "../types.js";
import type { CronServiceState } from "./state.js";

function resolveCronJobAgentId(state: CronServiceState, job: CronJob): string {
  const agentId = job.agentId?.trim();
  if (agentId) {
    return normalizeAgentId(agentId);
  }
  const parsedAgentId = parseAgentSessionKey(job.sessionKey)?.agentId?.trim();
  if (parsedAgentId) {
    return normalizeAgentId(parsedAgentId);
  }
  return normalizeAgentId(state.deps.defaultAgentId ?? DEFAULT_AGENT_ID);
}

function resolveActiveWorkspaceToken(): string {
  const activeWorkspaceId = readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
  return normalizeBustlyWorkspaceId(activeWorkspaceId);
}

export function isCronJobAllowedForActiveWorkspace(state: CronServiceState, job: CronJob): boolean {
  const activeWorkspaceToken = resolveActiveWorkspaceToken();
  const jobWorkspaceToken = resolveBustlyWorkspaceTokenFromAgentId(resolveCronJobAgentId(state, job));
  if (!jobWorkspaceToken) {
    return true;
  }
  if (!activeWorkspaceToken) {
    return false;
  }
  return normalizeBustlyWorkspaceId(jobWorkspaceToken) === activeWorkspaceToken;
}
