import type { BustlyHeartbeatEventRecord } from "../bustly/heartbeats.js";

export type BustlyHeartbeatBroadcastAction = "opened" | "reopened" | "status-updated";

export type BustlyHeartbeatBroadcastPayload = {
  kind: "heartbeat";
  ts: number;
  workspaceId: string;
  agentId: string;
  action: BustlyHeartbeatBroadcastAction;
  event: BustlyHeartbeatEventRecord;
};

const listeners = new Set<(evt: BustlyHeartbeatBroadcastPayload) => void>();

export function emitBustlyHeartbeatEvent(
  evt: Omit<BustlyHeartbeatBroadcastPayload, "kind" | "ts">,
) {
  const enriched: BustlyHeartbeatBroadcastPayload = {
    kind: "heartbeat",
    ts: Date.now(),
    ...evt,
  };
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      // ignore listener failures
    }
  }
}

export function onBustlyHeartbeatEvent(
  listener: (evt: BustlyHeartbeatBroadcastPayload) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
