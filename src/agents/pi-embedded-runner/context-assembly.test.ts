import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { assembleContextMessages } from "./context-assembly.js";

function makeUser(text: string): AgentMessage {
  return { role: "user", content: text, timestamp: Date.now() } as AgentMessage;
}

function makeAssistant(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "openai",
    model: "mock",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  } as AgentMessage;
}

function makeToolResult(text: string): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: "t1",
    toolName: "read",
    content: [{ type: "text", text }],
    isError: false,
    timestamp: Date.now(),
  } as AgentMessage;
}

describe("assembleContextMessages", () => {
  it("keeps the last configured turns when under budget", () => {
    const messages = [
      makeUser("u1"),
      makeAssistant("a1"),
      makeUser("u2"),
      makeAssistant("a2"),
      makeUser("u3"),
      makeAssistant("a3"),
    ];

    const result = assembleContextMessages({
      messages,
      turnLimit: 2,
      contextWindowTokens: 100_000,
    });

    expect(result.messages).toHaveLength(4);
    expect(result.messages[0]?.role).toBe("user");
    expect(result.report.turnLimitApplied).toBe(true);
    expect(result.report.tokenBudgetApplied).toBe(false);
  });

  it("previews oversized tool results", () => {
    const result = assembleContextMessages({
      messages: [makeUser("show me the file"), makeToolResult("x".repeat(12_000))],
      contextWindowTokens: 100_000,
    });

    expect(result.report.previewedToolResults).toBe(1);
    const tool = result.messages[1] as Extract<AgentMessage, { role: "toolResult" }>;
    const text = Array.isArray(tool.content) && tool.content[0] && "text" in tool.content[0]
      ? (tool.content[0] as { text: string }).text
      : "";
    expect(text).toContain("[Tool result preview:");
    expect(text.length).toBeLessThan(2_000);
  });

  it("applies token budget and shrinks oversized histories", () => {
    const messages = [
      makeUser("decision: keep the old sync protocol for enterprise workspaces"),
      makeAssistant("noted"),
      makeUser("filler ".repeat(2_000)),
      makeAssistant("reply ".repeat(2_000)),
      makeUser("latest question ".repeat(1_500)),
      makeAssistant("latest answer ".repeat(1_500)),
    ];

    const result = assembleContextMessages({
      messages,
      contextWindowTokens: 8_000,
      historyBudgetRatio: 0.12,
      historyBudgetMinTokens: 500,
      historyBudgetMaxTokens: 1_400,
    });

    expect(result.report.tokenBudgetApplied).toBe(true);
    expect(result.report.finalTokens).toBeLessThan(result.report.originalTokens);
    expect(result.messages.length).toBeLessThan(messages.length);
  });
});
