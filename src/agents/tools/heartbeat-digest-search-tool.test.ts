import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendHeartbeatDigestEntry } from "../heartbeat-digest-store.js";
import { createHeartbeatDigestSearchTool } from "./heartbeat-digest-search-tool.js";

function createDigestEntry(params: {
  timestampMs: number;
  query: string;
  questionSummary: string;
  questionDetail?: string;
  actionSummary: string;
  outcomeSummary: string;
  risk?: string;
}) {
  return {
    id: `digest-${params.timestampMs}`,
    createdAt: new Date(params.timestampMs).toISOString(),
    createdAtMs: params.timestampMs,
    sessionId: "session-1",
    sessionKey: "agent:main:main",
    query: params.query,
    userQuestion: {
      summary: params.questionSummary,
      ...(params.questionDetail ? { detail: params.questionDetail } : {}),
    },
    agentAction: {
      summary: params.actionSummary,
    },
    outcome: {
      status: "completed" as const,
      summary: params.outcomeSummary,
    },
    keywords: ["orders", "pending"],
    ...(params.risk
      ? {
          followUp: {
            risk: params.risk,
            unresolvedItems: [params.risk],
          },
        }
      : {}),
  };
}

describe("heartbeat_digest_search tool", () => {
  it("returns digest entries inside the requested time window", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "heartbeat-digest-search-"));
    const agentDir = path.join(root, "agent");
    await fs.mkdir(agentDir, { recursive: true });
    const inRangeTs = Date.now() - 5 * 60 * 1000;
    const outOfRangeTs = Date.now() - 2 * 60 * 60 * 1000;

    await appendHeartbeatDigestEntry({
      agentDir,
      entry: createDigestEntry({
        timestampMs: outOfRangeTs,
        query: "old issue",
        questionSummary: "旧问题",
        questionDetail: "已过窗口",
        actionSummary: "Reviewed an older issue.",
        outcomeSummary: "older summary",
      }),
    });
    await appendHeartbeatDigestEntry({
      agentDir,
      entry: createDigestEntry({
        timestampMs: inRangeTs,
        query: "pending order",
        questionSummary: "待支付订单",
        questionDetail: "订单仍未付款",
        actionSummary: "Checked the pending order status.",
        outcomeSummary: "checked pending order status",
      }),
    });

    const tool = createHeartbeatDigestSearchTool({ agentDir });
    expect(tool).toBeTruthy();
    const result = await tool!.execute("call-1", {
      from: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
      query: "pending",
      limit: 10,
    });

    const details = result.details as {
      searched?: number;
      returned?: number;
      entries?: Array<{ userQuestion?: { summary?: string } }>;
    };
    expect(details.searched).toBe(1);
    expect(details.returned).toBe(1);
    expect(details.entries?.[0]?.userQuestion?.summary).toBe("待支付订单");
  });

  it("rejects invalid timestamp ranges", async () => {
    const tool = createHeartbeatDigestSearchTool({ agentDir: "/tmp/agent" });
    await expect(
      tool!.execute("call-2", {
        from: "not-a-date",
        to: new Date().toISOString(),
      }),
    ).rejects.toThrow("from must be an ISO-8601 timestamp");

    await expect(
      tool!.execute("call-3", {
        from: new Date().toISOString(),
        to: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toThrow("to must be greater than or equal to from");
  });

  it("returns null when agentDir is missing", async () => {
    expect(createHeartbeatDigestSearchTool({ agentDir: "" })).toBeNull();
    expect(createHeartbeatDigestSearchTool()).toBeNull();
  });

  it("can search follow-up risks and unresolved items", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "heartbeat-digest-followup-"));
    const agentDir = path.join(root, "agent");
    await fs.mkdir(agentDir, { recursive: true });
    await appendHeartbeatDigestEntry({
      agentDir,
      entry: createDigestEntry({
        timestampMs: Date.now(),
        query: "klaviyo open rate",
        questionSummary: "打开率可以看到吗",
        questionDetail: "想看 open rate 和 click rate",
        actionSummary: "Checked Klaviyo campaign analytics availability.",
        outcomeSummary: "Could not retrieve Klaviyo open rate from the current API.",
        risk: "api limitation",
      }),
    });

    const tool = createHeartbeatDigestSearchTool({ agentDir });
    const result = await tool!.execute("call-followup", {
      from: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
      query: "api limitation",
      limit: 10,
    });

    const details = result.details as {
      returned?: number;
      entries?: Array<{ followUp?: { risk?: string } }>;
    };
    expect(details.returned).toBe(1);
    expect(details.entries?.[0]?.followUp?.risk).toBe("api limitation");
  });
});
