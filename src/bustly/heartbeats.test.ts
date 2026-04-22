import { describe, expect, it } from "vitest";
import {
  buildBustlyHeartbeatPrompt,
  buildBustlyHeartbeatRunPrompt,
  buildBustlyHeartbeatSystemPrompt,
  parseBustlyHeartbeatEventsJson,
  parseBustlyHeartbeatMarkdown,
  reconcileBustlyHeartbeatState,
  resolveBustlyHeartbeatHealthSummary,
  updateBustlyHeartbeatEventStatus,
} from "./heartbeats.js";

describe("parseBustlyHeartbeatEventsJson", () => {
  it("parses strict json array payloads", () => {
    const parsed = parseBustlyHeartbeatEventsJson(
      JSON.stringify([
        {
          severity: "warning",
          title: "Inventory drift",
          message: "Stock mismatch found",
          actionPrompt: "Recount inventory for SKU-123",
        },
      ]),
    );
    expect(parsed).toEqual([
      {
        severity: "warning",
        title: "Inventory drift",
        message: "Stock mismatch found",
        actionPrompt: "Recount inventory for SKU-123",
      },
    ]);
  });

  it("extracts the first valid json array from mixed model output", () => {
    const parsed = parseBustlyHeartbeatEventsJson(`
Now I have a clear picture:

[{"severity":"critical","title":"Payment risk","message":"3 failed payouts in a row","actionPrompt":"Audit payout settings and retry with finance."}]
    `);
    expect(parsed).toEqual([
      {
        severity: "critical",
        title: "Payment risk",
        message: "3 failed payouts in a row",
        actionPrompt: "Audit payout settings and retry with finance.",
      },
    ]);
  });

  it("accepts action fallback field aliases", () => {
    const parsed = parseBustlyHeartbeatEventsJson(
      JSON.stringify([
        {
          severity: "suggestion",
          title: "Add retention flow",
          message: "Cart abandonment rose 6% this week",
          action: "Draft a recovery email and assign to marketing.",
        },
      ]),
    );
    expect(parsed).toEqual([
      {
        severity: "suggestion",
        title: "Add retention flow",
        message: "Cart abandonment rose 6% this week",
        actionPrompt: "Draft a recovery email and assign to marketing.",
      },
    ]);
  });
});

describe("parseBustlyHeartbeatMarkdown", () => {
  it("treats the full heartbeat markdown as the definition content", () => {
    const parsed = parseBustlyHeartbeatMarkdown(`# HEARTBEAT.md

Monitor payment failures and conversion drops.

Notify me when any critical risk appears.
`);
    expect(parsed).toEqual({
      content: "# HEARTBEAT.md\n\nMonitor payment failures and conversion drops.\n\nNotify me when any critical risk appears.",
    });
  });
});

describe("bustly heartbeat prompts", () => {
  it("keeps heartbeat guidance in the message prompt", () => {
    const systemPrompt = buildBustlyHeartbeatSystemPrompt();
    const runPrompt = buildBustlyHeartbeatRunPrompt();
    const prompt = buildBustlyHeartbeatPrompt();

    expect(systemPrompt).toBe("");
    expect(runPrompt).toContain("Output rules:");
    expect(prompt).toContain("Read `heartbeat.md`");
  });

  it("injects preferred language rules when provided", () => {
    const runPrompt = buildBustlyHeartbeatRunPrompt({
      preferredLanguage: "zh-CN",
    });
    expect(runPrompt).toContain("Language rules:");
    expect(runPrompt).toContain("Preferred language for this heartbeat: zh-CN");
  });
});

describe("reconcileBustlyHeartbeatState", () => {
  it("keeps unmatched open events open instead of auto-resolving", () => {
    const previous = {
      agentId: "agent-a",
      lastScanAt: 1_000,
      lastPayloadText: "previous payload",
      lastPayloadAt: 1_000,
      events: [
        {
          id: "evt-keep-open",
          agentId: "agent-a",
          severity: "warning" as const,
          title: "Inventory drift",
          message: "Stock mismatch found",
          actionPrompt: "Recount inventory for SKU-123",
          status: "open" as const,
          createdAt: 900,
          updatedAt: 950,
        },
      ],
    };

    const next = reconcileBustlyHeartbeatState({
      agentId: "agent-a",
      previous,
      events: [],
      scannedAt: 2_000,
      payloadText: "no new events",
    });

    expect(next.events).toHaveLength(1);
    expect(next.events[0]).toMatchObject({
      id: "evt-keep-open",
      status: "open",
      createdAt: 900,
      updatedAt: 950,
    });
  });

  it("reopens previously handled events when they reappear", () => {
    const previous = {
      agentId: "agent-a",
      lastScanAt: 1_000,
      lastPayloadText: "previous payload",
      lastPayloadAt: 1_000,
      events: [
        {
          id: "evt-resolved",
          agentId: "agent-a",
          severity: "critical" as const,
          title: "Payment risk",
          message: "3 failed payouts in a row",
          actionPrompt: "Audit payout settings and retry.",
          status: "seen" as const,
          createdAt: 800,
          updatedAt: 1_000,
        },
      ],
    };

    const next = reconcileBustlyHeartbeatState({
      agentId: "agent-a",
      previous,
      events: [
        {
          severity: "critical",
          title: "Payment risk",
          message: "3 failed payouts in a row",
          actionPrompt: "Audit payout settings and retry.",
        },
      ],
      scannedAt: 2_000,
      payloadText: "new payload",
    });

    expect(next.events).toHaveLength(1);
    expect(next.events[0]).toMatchObject({
      id: "evt-resolved",
      status: "open",
      createdAt: 800,
      updatedAt: 2_000,
    });
  });
});

describe("resolveBustlyHeartbeatHealthSummary", () => {
  it("maps open critical events to Critical status", () => {
    const summary = resolveBustlyHeartbeatHealthSummary({
      lastScanAt: 1,
      events: [
        {
          id: "evt-1",
          agentId: "agent-a",
          severity: "critical",
          title: "Critical issue",
          message: "Critical issue message",
          actionPrompt: "Do something now",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(summary.status).toBe("Critical");
  });

  it("maps warning-only open events to Warning status", () => {
    const summary = resolveBustlyHeartbeatHealthSummary({
      lastScanAt: 2,
      events: [
        {
          id: "evt-1",
          agentId: "agent-a",
          severity: "warning",
          title: "Warning issue",
          message: "Warning issue message",
          actionPrompt: "Do something",
          status: "open",
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    });
    expect(summary.status).toBe("Warning");
  });

  it("ignores seen/actioned events for status escalation", () => {
    const summary = resolveBustlyHeartbeatHealthSummary({
      lastScanAt: 3,
      events: [
        {
          id: "evt-1",
          agentId: "agent-a",
          severity: "critical",
          title: "Resolved critical",
          message: "Resolved critical message",
          actionPrompt: "None",
          status: "seen",
          createdAt: 3,
          updatedAt: 3,
        },
        {
          id: "evt-2",
          agentId: "agent-a",
          severity: "warning",
          title: "Actioned warning",
          message: "Actioned warning message",
          actionPrompt: "None",
          status: "actioned",
          createdAt: 3,
          updatedAt: 3,
        },
      ],
    });
    expect(summary.status).toBe("Healthy");
  });

  it("keeps healthy when only suggestion events are open", () => {
    const summary = resolveBustlyHeartbeatHealthSummary({
      lastScanAt: 4,
      events: [
        {
          id: "evt-1",
          agentId: "agent-a",
          severity: "suggestion",
          title: "Suggestion only",
          message: "Suggestion message",
          actionPrompt: "Optional action",
          status: "open",
          createdAt: 4,
          updatedAt: 4,
        },
      ],
    });
    expect(summary.status).toBe("Healthy");
  });
});

describe("updateBustlyHeartbeatEventStatus", () => {
  it("updates status and timestamp for the matched event", () => {
    const result = updateBustlyHeartbeatEventStatus({
      state: {
        agentId: "agent-a",
        lastScanAt: 1_000,
        lastPayloadText: "payload",
        lastPayloadAt: 1_000,
        events: [
          {
            id: "evt-1",
            agentId: "agent-a",
            severity: "warning",
            title: "Inventory drift",
            message: "Stock mismatch found",
            actionPrompt: "Recount inventory",
            status: "open",
            createdAt: 100,
            updatedAt: 200,
          },
        ],
      },
      eventId: "evt-1",
      status: "actioned",
      updatedAt: 2_000,
    });
    expect(result.event).toMatchObject({
      id: "evt-1",
      status: "actioned",
      updatedAt: 2_000,
    });
    expect(result.state.events[0]?.status).toBe("actioned");
  });

  it("returns null event when no matching id exists", () => {
    const state = {
      agentId: "agent-a",
      lastScanAt: null,
      lastPayloadText: "",
      lastPayloadAt: null,
      events: [],
    };
    const result = updateBustlyHeartbeatEventStatus({
      state,
      eventId: "missing",
      status: "seen",
    });
    expect(result.event).toBeNull();
    expect(result.state).toEqual(state);
  });
});
