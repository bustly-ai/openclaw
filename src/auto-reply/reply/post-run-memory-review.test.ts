import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS,
  enforceRuntimeRouting,
  resolvePostRunMemoryReviewSettings,
} from "./post-run-memory-review.js";

describe("enforceRuntimeRouting", () => {
  it("promotes repeated procedural work to skill when a skill payload is present", () => {
    const settings = resolvePostRunMemoryReviewSettings({
      agents: {
        defaults: {
          selfEvolution: {
            enabled: true,
            minToolCalls: DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS,
          },
        },
      },
    });
    expect(settings).not.toBeNull();
    if (!settings) {
      throw new Error("missing settings");
    }

    const routed = enforceRuntimeRouting({
      classification: {
        layer: "memory",
        reason: "model_chose_memory",
        confidence: 0.92,
        repeatedTask: false,
        summary: "This workflow keeps recurring.",
        memory: {
          target: "memory_md",
          heading: "Monthly report note",
          body: "The monthly report follows the same steps.",
        },
        skill: {
          skillName: "monthly-report-workflow",
          description: "Generate the monthly report consistently",
          body: "# Monthly Report Workflow\n\n1. Pull metrics.\n2. Format summary.\n",
        },
      },
      matchedPriorSessions: 2,
      toolCallCount: 0,
      settings,
    });

    expect(routed.layer).toBe("skill");
    expect(routed.repeatedTask).toBe(true);
    expect(routed.reason).toBe("runtime_promoted_repeated_procedure");
  });
});
