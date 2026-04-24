import {
  applyBustlyRuntimeManifest,
} from "../../bustly/runtime-manifest.js";
import { resolveActiveBustlyWorkspaceBinding } from "../../bustly/workspace-runtime.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const bustlyWorkspaceHandlers: GatewayRequestHandlers = {
  "bustly.workspace.get-active": ({ respond }) => {
    try {
      const active = resolveActiveBustlyWorkspaceBinding();
      if (!active) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "No active Bustly workspace found. Please sign in first.",
          ),
        );
        return;
      }
      respond(
        true,
        {
          workspaceId: active.workspaceId,
          agentId: active.agentId,
          workspaceDir: active.workspaceDir,
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
  "bustly.workspace.set-active": async ({ params, respond }) => {
    try {
      const workspaceId = typeof params.workspaceId === "string" ? params.workspaceId.trim() : "";
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
      const binding = await applyBustlyRuntimeManifest({
        workspaceId,
        workspaceName,
        allowCreateConfig: true,
        userAgent: "openclaw-cloud",
      });
      respond(
        true,
        {
          workspaceId: binding.workspaceId,
          agentId: binding.agentId,
          workspaceDir: binding.workspaceDir,
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
