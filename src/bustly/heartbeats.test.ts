import { describe, expect, it } from "vitest";
import {
  parseBustlyHeartbeatEventsJson,
  parseBustlyHeartbeatMarkdown,
  resolveBustlyHeartbeatHealthSummary,
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
  it("reads both Goal and trailing Notify When sections", () => {
    const parsed = parseBustlyHeartbeatMarkdown(`# HEARTBEAT.md

## Goal
Monitor payment failures and conversion drops.

## Notify When
Notify me when any critical risk appears.
`);
    expect(parsed).toEqual({
      goal: "Monitor payment failures and conversion drops.",
      notifyWhen: "Notify me when any critical risk appears.",
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

  it("ignores resolved events for status escalation", () => {
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
          status: "resolved",
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
