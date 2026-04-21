import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendHeartbeatDigestEntry } from "../heartbeat-digest-store.js";
import { createHeartbeatDigestSearchTool } from "./heartbeat-digest-search-tool.js";

function createDigestEntry(params: {
  timestampMs: number;
  query: string;
  issueTitle: string;
  issueMessage: string;
  summary: string;
}) {
  return {
    id: `digest-${params.timestampMs}`,
    createdAt: new Date(params.timestampMs).toISOString(),
    createdAtMs: params.timestampMs,
    sessionId: "session-1",
    sessionKey: "agent:main:main",
    reviewRunId: "review-1",
    query: params.query,
    userIssue: {
      title: params.issueTitle,
      message: params.issueMessage,
    },
    taskResult: {
      status: "completed" as const,
      summary: params.summary,
      toolCallCount: 2,
      layer: "memory" as const,
      reason: "ok",
      confidence: 0.9,
    },
    snippet: "assistant: done",
    keywords: ["orders", "pending"],
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
        issueTitle: "旧问题",
        issueMessage: "已过窗口",
        summary: "older summary",
      }),
    });
    await appendHeartbeatDigestEntry({
      agentDir,
      entry: createDigestEntry({
        timestampMs: inRangeTs,
        query: "pending order",
        issueTitle: "待支付订单",
        issueMessage: "订单仍未付款",
        summary: "checked pending order status",
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
      entries?: Array<{ userIssue?: { title?: string } }>;
    };
    expect(details.searched).toBe(1);
    expect(details.returned).toBe(1);
    expect(details.entries?.[0]?.userIssue?.title).toBe("待支付订单");
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
});
