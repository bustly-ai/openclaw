import { describe, expect, it } from "vitest";
import { parseBustlyHeartbeatEventsJson, parseBustlyHeartbeatMarkdown } from "./heartbeats.js";

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
