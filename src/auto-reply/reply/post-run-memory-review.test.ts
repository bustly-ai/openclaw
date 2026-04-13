import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_RUN_MEMORY_REVIEW_MODEL,
  DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS,
  enforceRuntimeRouting,
  resolvePostRunMemoryReviewSettings,
} from "./post-run-memory-review.js";

describe("resolvePostRunMemoryReviewSettings", () => {
  it("defaults the review model to bustly standard", () => {
    const settings = resolvePostRunMemoryReviewSettings({});
    expect(settings?.reviewModel).toBe(DEFAULT_POST_RUN_MEMORY_REVIEW_MODEL);
  });

  it("accepts an explicit review model override", () => {
    const settings = resolvePostRunMemoryReviewSettings({
      agents: {
        defaults: {
          selfEvolution: {
            reviewModel: "openai/gpt-5.2-mini",
          },
        },
      },
    });
    expect(settings?.reviewModel).toBe("openai/gpt-5.2-mini");
  });
});

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

  it("keeps first-seen retrieval precedents instead of dropping them", () => {
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
        layer: "retrieval_only",
        reason: "first_seen_correction_precedent",
        confidence: 0.88,
        repeatedTask: false,
        summary: "The agent corrected a pagination mistake after user feedback.",
      },
      matchedPriorSessions: 0,
      toolCallCount: 3,
      settings,
    });

    expect(routed.layer).toBe("retrieval_only");
    expect(routed.reason).toBe("first_seen_correction_precedent");
    expect(routed.repeatedTask).toBe(false);
  });
});
