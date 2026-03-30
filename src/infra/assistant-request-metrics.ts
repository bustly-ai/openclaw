export type AssistantRequestMetric = {
  ttftMs?: number;
  ttlrMs?: number;
};

type AssistantRequestTiming = {
  startedAtMs: number;
  firstDeltaAtMs?: number;
  updatedAtMs: number;
};

type RunTimingState = {
  active?: AssistantRequestTiming;
  completed: AssistantRequestMetric[];
  updatedAtMs: number;
};

const ASSISTANT_REQUEST_METRIC_TTL_MS = 30 * 60 * 1000;
const metricsByRunId = new Map<string, RunTimingState>();

function prune(now = Date.now()) {
  for (const [runId, state] of metricsByRunId) {
    if (now - state.updatedAtMs > ASSISTANT_REQUEST_METRIC_TTL_MS) {
      metricsByRunId.delete(runId);
    }
  }
}

function getOrCreateState(runId: string, now: number): RunTimingState {
  const existing = metricsByRunId.get(runId);
  if (existing) {
    existing.updatedAtMs = now;
    return existing;
  }
  const created: RunTimingState = {
    completed: [],
    updatedAtMs: now,
  };
  metricsByRunId.set(runId, created);
  return created;
}

function normalizeRunId(runId: string): string {
  return runId.trim();
}

export function recordAssistantRequestStart(runId: string, startedAtMs = Date.now()) {
  const normalized = normalizeRunId(runId);
  if (!normalized) {
    return;
  }
  prune(startedAtMs);
  const state = getOrCreateState(normalized, startedAtMs);
  state.active = {
    startedAtMs,
    updatedAtMs: startedAtMs,
  };
}

export function recordAssistantRequestFirstDelta(runId: string, atMs = Date.now()) {
  const normalized = normalizeRunId(runId);
  if (!normalized) {
    return;
  }
  prune(atMs);
  const state = getOrCreateState(normalized, atMs);
  const active =
    state.active ??
    ({
      startedAtMs: atMs,
      updatedAtMs: atMs,
    } satisfies AssistantRequestTiming);
  active.updatedAtMs = atMs;
  if (active.firstDeltaAtMs === undefined) {
    active.firstDeltaAtMs = atMs;
  }
  state.active = active;
}

export function recordAssistantRequestEnd(runId: string, endedAtMs = Date.now()) {
  const normalized = normalizeRunId(runId);
  if (!normalized) {
    return;
  }
  prune(endedAtMs);
  const state = getOrCreateState(normalized, endedAtMs);
  const active = state.active;
  if (!active) {
    return;
  }
  const metric = {
    ttftMs:
      active.firstDeltaAtMs === undefined ? undefined : Math.max(0, active.firstDeltaAtMs - active.startedAtMs),
    ttlrMs: Math.max(0, endedAtMs - active.startedAtMs),
  } satisfies AssistantRequestMetric;
  state.completed.push(metric);
  state.active = undefined;
  state.updatedAtMs = endedAtMs;
}

export function consumeCompletedAssistantRequestMetrics(runId: string): AssistantRequestMetric[] {
  const normalized = normalizeRunId(runId);
  if (!normalized) {
    return [];
  }
  const state = metricsByRunId.get(normalized);
  if (!state || state.completed.length === 0) {
    return [];
  }
  const completed = state.completed.slice();
  state.completed.length = 0;
  if (!state.active) {
    metricsByRunId.delete(normalized);
  }
  return completed;
}

export function resetAssistantRequestMetricsForTest() {
  metricsByRunId.clear();
}
