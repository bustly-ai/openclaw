type ChatTurnTiming = {
  startedAtMs: number;
  firstDeltaAtMs?: number;
  updatedAtMs: number;
};

const CHAT_TURN_METRIC_TTL_MS = 30 * 60 * 1000;
const metricsByTurnId = new Map<string, ChatTurnTiming>();

function prune(now = Date.now()) {
  for (const [turnId, timing] of metricsByTurnId) {
    if (now - timing.updatedAtMs > CHAT_TURN_METRIC_TTL_MS) {
      metricsByTurnId.delete(turnId);
    }
  }
}

export function recordChatTurnStart(turnId: string, startedAtMs = Date.now()) {
  const normalized = turnId.trim();
  if (!normalized) {
    return;
  }
  prune(startedAtMs);
  metricsByTurnId.set(normalized, {
    startedAtMs,
    updatedAtMs: startedAtMs,
  });
}

export function recordChatTurnFirstDelta(turnId: string, atMs = Date.now()) {
  const normalized = turnId.trim();
  if (!normalized) {
    return;
  }
  prune(atMs);
  const existing = metricsByTurnId.get(normalized);
  if (!existing) {
    metricsByTurnId.set(normalized, {
      startedAtMs: atMs,
      firstDeltaAtMs: atMs,
      updatedAtMs: atMs,
    });
    return;
  }
  existing.updatedAtMs = atMs;
  if (existing.firstDeltaAtMs === undefined) {
    existing.firstDeltaAtMs = atMs;
  }
}

export function consumeChatTurnTtftMs(turnId: string): number | undefined {
  const normalized = turnId.trim();
  if (!normalized) {
    return undefined;
  }
  const timing = metricsByTurnId.get(normalized);
  metricsByTurnId.delete(normalized);
  if (!timing || timing.firstDeltaAtMs === undefined) {
    return undefined;
  }
  return Math.max(0, timing.firstDeltaAtMs - timing.startedAtMs);
}

export function resetChatTurnMetricsForTest() {
  metricsByTurnId.clear();
}
