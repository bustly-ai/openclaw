import { readBustlyOAuthState } from "../../bustly-oauth.js";
import {
  applyBustlyRuntimeManifest,
  bootstrapBustlyRuntime,
  getBustlyRuntimeHealthSnapshot,
  type BustlyRuntimePresetAgent,
} from "../../bustly/runtime-manifest.js";
import { createBustlyIssueReportArchive } from "../../bustly/issue-report.js";
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

function normalizePresetAgentsInput(raw: unknown): BustlyRuntimePresetAgent[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      slug: typeof entry.slug === "string" ? entry.slug.trim() : "",
      label: typeof entry.label === "string" ? entry.label.trim() : "",
      icon: typeof entry.icon === "string" ? entry.icon.trim() : undefined,
      isMain: entry.isMain === true,
    }))
    .filter((entry) => entry.slug && entry.label);
}

export const bustlyRuntimeHandlers: GatewayRequestHandlers = {
  "bustly.runtime.health": ({ respond }) => {
    try {
      respond(true, getBustlyRuntimeHealthSnapshot(), undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          err instanceof Error ? err.message : String(err),
        ),
      );
    }
  },
  "bustly.runtime.manifest.apply": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }

      const workspaceName =
        typeof params.workspaceName === "string" ? params.workspaceName.trim() : undefined;
      const agentName = typeof params.agentName === "string" ? params.agentName.trim() : undefined;
      const selectedModelInput =
        typeof params.selectedModel === "string"
          ? params.selectedModel.trim()
          : typeof params.model === "string"
            ? params.model.trim()
            : undefined;
      const userAgent = typeof params.userAgent === "string" ? params.userAgent.trim() : undefined;
      const baseUrl = typeof params.baseUrl === "string" ? params.baseUrl.trim() : undefined;
      const presetAgents = normalizePresetAgentsInput(params.presetAgents);

      const applied = await applyBustlyRuntimeManifest({
        workspaceId,
        workspaceName,
        agentName,
        selectedModelInput,
        userAgent,
        baseUrl,
        presetAgents,
      });

      respond(
        true,
        {
          workspaceId: applied.workspaceId,
          agentId: applied.agentId,
          workspaceDir: applied.workspaceDir,
          presetAgentsApplied: applied.presetAgentsApplied,
        },
        undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorCode = message.includes("workspaceId") ? ErrorCodes.INVALID_REQUEST : ErrorCodes.UNAVAILABLE;
      respond(
        false,
        undefined,
        errorShape(errorCode, message),
      );
    }
  },
  "bustly.runtime.bootstrap": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const workspaceName =
        typeof params.workspaceName === "string" ? params.workspaceName.trim() : undefined;
      const agentName = typeof params.agentName === "string" ? params.agentName.trim() : undefined;
      const selectedModelInput =
        typeof params.selectedModel === "string"
          ? params.selectedModel.trim()
          : typeof params.model === "string"
            ? params.model.trim()
            : undefined;
      const userAgent = typeof params.userAgent === "string" ? params.userAgent.trim() : undefined;
      const baseUrl = typeof params.baseUrl === "string" ? params.baseUrl.trim() : undefined;
      const presetAgents = Array.isArray(params.presetAgents)
        ? normalizePresetAgentsInput(params.presetAgents)
        : undefined;

      const bootstrapped = await bootstrapBustlyRuntime({
        workspaceId: workspaceId || undefined,
        workspaceName,
        agentName,
        selectedModelInput,
        userAgent,
        baseUrl,
        presetAgents,
      });

      respond(
        true,
        {
          workspaceId: bootstrapped.workspaceId,
          agentId: bootstrapped.agentId,
          workspaceDir: bootstrapped.workspaceDir,
          presetAgentsApplied: bootstrapped.presetAgentsApplied,
        },
        undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorCode = message.includes("workspaceId") ? ErrorCodes.INVALID_REQUEST : ErrorCodes.UNAVAILABLE;
      respond(
        false,
        undefined,
        errorShape(errorCode, message),
      );
    }
  },
  "bustly.runtime.report-issue": async ({ params, respond }) => {
    try {
      const outputDir =
        typeof params.outputDir === "string" && params.outputDir.trim()
          ? params.outputDir.trim()
          : undefined;
      const stateDir =
        typeof params.stateDir === "string" && params.stateDir.trim()
          ? params.stateDir.trim()
          : undefined;
      const report = await createBustlyIssueReportArchive({
        outputDir,
        stateDir,
      });
      respond(
        true,
        {
          archivePath: report.archivePath,
          stateDir: report.stateDir,
          outputDir: report.outputDir,
        },
        undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, message),
      );
    }
  },
};
