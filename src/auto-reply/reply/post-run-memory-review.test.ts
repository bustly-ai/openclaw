import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_RUN_MEMORY_REVIEW_MODEL,
  DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS,
  enforceRuntimeRouting,
  parseConsolidationClassificationFromText,
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

describe("parseConsolidationClassificationFromText", () => {
  it("accepts JSON5-style outputs with unquoted keys and single quotes", () => {
    const parsed = parseConsolidationClassificationFromText(`{
      layer: 'memory',
      reason: 'working_context',
      confidence: 0.9,
      repeatedTask: false,
      summary: 'Capture a short-lived note',
      memory: {
        target: 'daily_log',
        heading: 'Daily note',
        body: 'Check Docker daemon before desktop automation.'
      }
    }`);

    expect(parsed.layer).toBe("memory");
    expect(parsed.memory?.target).toBe("daily_log");
  });

  it("extracts the first balanced JSON object when extra braces appear later", () => {
    const parsed = parseConsolidationClassificationFromText(`Output:
{"layer":"none","reason":"transient","confidence":0.86,"repeatedTask":false,"summary":"No durable write."}
diagnostic {not-json}`);

    expect(parsed.layer).toBe("none");
    expect(parsed.reason).toBe("transient");
  });

  it("skips invalid brace blocks and parses the next valid JSON object", () => {
    const parsed = parseConsolidationClassificationFromText(`note {not_json_here}
{"layer":"memory","reason":"working_context","confidence":0.91,"repeatedTask":false,"summary":"valid payload","memory":{"target":"daily_log","heading":"H","body":"B"}}`);

    expect(parsed.layer).toBe("memory");
    expect(parsed.memory?.target).toBe("daily_log");
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

    expect(routed.primaryLayer).toBe("skill");
    expect(routed.repeatedTask).toBe(true);
    expect(routed.reason).toBe("runtime_promoted_repeated_procedure");
    expect(routed.writeSkill?.skillName).toBe("monthly-report-workflow");
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

    expect(routed.primaryLayer).toBe("retrieval_only");
    expect(routed.reason).toBe("first_seen_correction_precedent");
    expect(routed.repeatedTask).toBe(false);
    expect(routed.writeRetrieval).toBe(true);
  });

  it("preserves explicit correction episodes even when the model returns none", () => {
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
        layer: "none",
        reason: "transient_business_analysis",
        confidence: 0.91,
        repeatedTask: false,
        summary: "The agent corrected the original mistaken conclusion after user feedback.",
        correction: {
          wrongAssumption: "The agent assumed the first 250 orders represented the full result set.",
          userCorrection: "The user asked why there were only 250 orders and whether pagination was used.",
          verifiedFix: "The agent checked the count endpoint and paginated to retrieve the full order set.",
          actionableRule: "When Shopify returns 250 orders, verify count and paginate before concluding totals.",
          scope: "Shopify order analysis",
        },
      },
      matchedPriorSessions: 0,
      toolCallCount: 3,
      settings,
    });

    expect(routed.primaryLayer).toBe("retrieval_only");
    expect(routed.reason).toBe("runtime_preserved_correction_precedent");
    expect(routed.writeRetrieval).toBe(true);
  });

  it("writes retrieval alongside memory when both durable memory and precedent are extracted", () => {
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
        reason: "durable_constraint_with_example",
        confidence: 0.9,
        repeatedTask: false,
        summary: "The user corrected an assumption about Shopify order pagination.",
        correction: {
          wrongAssumption: "The first page represented the whole order history.",
          userCorrection: "The user asked why there were only 250 orders.",
          verifiedFix: "The agent paginated and retrieved the full set.",
          actionableRule: "Always verify Shopify count and paginate past 250.",
        },
        memory: {
          target: "memory_md",
          heading: "Shopify Pagination Constraint",
          body: "Shopify orders require pagination beyond the 250 item limit.",
        },
      },
      matchedPriorSessions: 0,
      toolCallCount: 4,
      settings,
    });

    expect(routed.primaryLayer).toBe("memory_long");
    expect(routed.writeMemory?.heading).toBe("Shopify Pagination Constraint");
    expect(routed.writeRetrieval).toBe(true);
  });

  it("routes daily log writes to the short-term memory layer", () => {
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
        reason: "working_context",
        confidence: 0.87,
        repeatedTask: false,
        summary: "Track this week deployment blockers in daily notes.",
        memory: {
          target: "daily_log",
          heading: "Deployment blockers",
          body: "Docker daemon must be running before containerized desktop automation.",
        },
      },
      matchedPriorSessions: 0,
      toolCallCount: 1,
      settings,
    });

    expect(routed.primaryLayer).toBe("memory_short");
    expect(routed.writeMemory?.target).toBe("daily_log");
  });

  it("ignores memory payload when classifier layer is not memory", () => {
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
        layer: "skill",
        reason: "reusable_procedure",
        confidence: 0.9,
        repeatedTask: true,
        summary: "Reusable rollout checklist extracted from repeated runs.",
        memory: {
          target: "memory_md",
          heading: "Should not be written",
          body: "This should be ignored because layer=skill.",
        },
        skill: {
          skillName: "deployment-precheck",
          description: "Precheck before running containerized deployment",
          body: "# Deployment Precheck\n\n1. Verify Docker daemon.\n",
        },
      },
      matchedPriorSessions: 0,
      toolCallCount: 6,
      settings,
    });

    expect(routed.primaryLayer).toBe("skill");
    expect(routed.writeSkill?.skillName).toBe("deployment-precheck");
    expect(routed.writeMemory).toBeUndefined();
  });

  it("routes explicit heartbeat goals to HEARTBEAT.md writes", () => {
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
        layer: "heartbeat",
        reason: "long_term_goal_detected",
        confidence: 0.86,
        repeatedTask: false,
        summary: "Customer repeatedly asks for weekly churn tracking and proactive alerts.",
        heartbeat: {
          heading: "Weekly churn tracking",
          body: "Track churn weekly and notify when churn accelerates for two consecutive weeks.",
        },
      },
      matchedPriorSessions: 0,
      toolCallCount: 1,
      settings,
    });

    expect(routed.primaryLayer).toBe("heartbeat");
    expect(routed.writeHeartbeat).toEqual({
      heading: "Weekly churn tracking",
      body: "Track churn weekly and notify when churn accelerates for two consecutive weeks.",
    });
  });

  it("does not auto-promote repeated tasks into heartbeat without heartbeat payload", () => {
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
        layer: "none",
        reason: "repeated_workflow",
        confidence: 0.91,
        repeatedTask: true,
        summary: "Run inventory reconciliation every Monday and escalate if delta exceeds 2%.",
      },
      matchedPriorSessions: 0,
      toolCallCount: 0,
      settings,
    });

    expect(routed.writeHeartbeat).toBeUndefined();
    expect(routed.primaryLayer).toBe("none");
    expect(routed.reason).toBe("repeated_workflow");
  });

  it("reports missing heartbeat payload when layer=heartbeat but heartbeat body is absent", () => {
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
        layer: "heartbeat",
        reason: "long_term_goal_detected",
        confidence: 0.93,
        repeatedTask: false,
        summary: "Keep watching weekly churn trend and alert on acceleration.",
      },
      matchedPriorSessions: 0,
      toolCallCount: 0,
      settings,
    });

    expect(routed.writeHeartbeat).toBeUndefined();
    expect(routed.primaryLayer).toBe("none");
    expect(routed.reason).toBe("missing_heartbeat_payload");
  });
});
