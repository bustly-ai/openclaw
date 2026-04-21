import { Type } from "@sinclair/typebox";
import { searchHeartbeatDigestEntries } from "../heartbeat-digest-store.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam, ToolInputError } from "./common.js";

const HeartbeatDigestSearchSchema = Type.Object({
  from: Type.String(),
  to: Type.String(),
  query: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1 })),
});

function parseTimestampMs(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ToolInputError(`${label} must be an ISO-8601 timestamp`);
  }
  return Math.floor(parsed);
}

export function createHeartbeatDigestSearchTool(opts?: { agentDir?: string }): AnyAgentTool | null {
  const agentDir = opts?.agentDir?.trim();
  if (!agentDir) {
    return null;
  }

  return {
    label: "Heartbeat Digest Search",
    name: "heartbeat_digest_search",
    description:
      "Search single-run heartbeat digests for this agent within an explicit time range. Use for periodic heartbeat scans to inspect recent user issues and completed results without reprocessing old windows.",
    parameters: HeartbeatDigestSearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const fromRaw = readStringParam(params, "from", { required: true, label: "from" });
      const toRaw = readStringParam(params, "to", { required: true, label: "to" });
      const fromMs = parseTimestampMs(fromRaw, "from");
      const toMs = parseTimestampMs(toRaw, "to");
      if (toMs < fromMs) {
        throw new ToolInputError("to must be greater than or equal to from");
      }
      const query = readStringParam(params, "query");
      const limit = Math.max(
        1,
        Math.min(200, Math.floor(readNumberParam(params, "limit", { integer: true }) ?? 20)),
      );
      const result = await searchHeartbeatDigestEntries({
        agentDir,
        fromMs,
        toMs,
        query,
        limit,
      });
      return jsonResult({
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        query: query?.trim() || "",
        limit,
        searched: result.searched,
        returned: result.returned,
        entries: result.entries,
      });
    },
  };
}

