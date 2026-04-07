import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeCompletedAssistantRequestMetrics,
  recordAssistantRequestEnd,
  recordAssistantRequestFirstDelta,
  recordAssistantRequestStart,
  resetAssistantRequestMetricsForTest,
} from "./assistant-request-metrics.js";

describe("assistant-request-metrics", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetAssistantRequestMetricsForTest();
  });

  it("records ttft and ttlr for a completed assistant request", () => {
    recordAssistantRequestStart("run-1", 100);
    recordAssistantRequestFirstDelta("run-1", 180);
    recordAssistantRequestEnd("run-1", 420);

    expect(consumeCompletedAssistantRequestMetrics("run-1")).toEqual([
      {
        ttftMs: 80,
        ttlrMs: 320,
      },
    ]);
  });

  it("tracks multiple assistant requests under the same run id", () => {
    recordAssistantRequestStart("run-1", 100);
    recordAssistantRequestFirstDelta("run-1", 140);
    recordAssistantRequestEnd("run-1", 260);

    recordAssistantRequestStart("run-1", 400);
    recordAssistantRequestFirstDelta("run-1", 430);
    recordAssistantRequestEnd("run-1", 520);

    expect(consumeCompletedAssistantRequestMetrics("run-1")).toEqual([
      {
        ttftMs: 40,
        ttlrMs: 160,
      },
      {
        ttftMs: 30,
        ttlrMs: 120,
      },
    ]);
  });

  it("returns an empty list when no completed request exists", () => {
    recordAssistantRequestStart("run-1", 100);
    recordAssistantRequestFirstDelta("run-1", 140);

    expect(consumeCompletedAssistantRequestMetrics("run-1")).toEqual([]);
  });
});
