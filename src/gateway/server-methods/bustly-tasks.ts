import type { GatewayRequestHandlers } from "./types.js";
import { getActiveEmbeddedRunCount } from "../../agents/pi-embedded-runner/runs.js";
import type { DedupeEntry } from "../server-shared.js";

function countAcceptedAgentRuns(dedupe: Map<string, DedupeEntry>): number {
  let count = 0;
  for (const [key, entry] of dedupe) {
    if (!key.startsWith("agent:")) {
      continue;
    }
    const payload = entry?.payload;
    if (!payload || typeof payload !== "object") {
      continue;
    }
    const status = (payload as { status?: unknown }).status;
    if (status === "accepted") {
      count += 1;
    }
  }
  return count;
}

export const bustlyTasksHandlers: GatewayRequestHandlers = {
  "bustly.tasks.status": ({ respond, context }) => {
    const activeChatAbortCount = context.chatAbortControllers.size;
    const activeEmbeddedRunCount = getActiveEmbeddedRunCount();
    const activeAgentRunSeqCount = context.agentRunSeq.size;
    const activeAcceptedAgentRuns = countAcceptedAgentRuns(context.dedupe);
    const runningCount = Math.max(
      activeChatAbortCount,
      activeEmbeddedRunCount,
      activeAgentRunSeqCount,
      activeAcceptedAgentRuns,
    );
    respond(
      true,
      {
        hasRunningTasks: runningCount > 0,
        runningCount,
      },
      undefined,
    );
  },
};
