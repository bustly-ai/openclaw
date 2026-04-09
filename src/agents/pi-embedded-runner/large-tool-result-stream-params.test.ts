import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  hasOversizedToolResult,
  OVERSIZED_TOOL_RESULT_CHARS,
  OVERSIZED_TOOL_RESULT_MAX_TOKENS,
  resolveLargeToolResultStreamParams,
} from "./large-tool-result-stream-params.js";

function createToolResult(text: string): AgentMessage {
  return {
    role: "toolResult",
    content: [{ type: "text", text }],
  } as AgentMessage;
}

describe("large tool result stream params", () => {
  it("detects oversized tool results", () => {
    expect(
      hasOversizedToolResult([createToolResult("x".repeat(OVERSIZED_TOOL_RESULT_CHARS + 1))]),
    ).toBe(true);
    expect(
      hasOversizedToolResult([createToolResult("x".repeat(OVERSIZED_TOOL_RESULT_CHARS))]),
    ).toBe(false);
  });

  it("caps maxTokens when an oversized tool result is present", () => {
    expect(
      resolveLargeToolResultStreamParams({
        messages: [createToolResult("x".repeat(OVERSIZED_TOOL_RESULT_CHARS + 1))],
      }),
    ).toEqual({ maxTokens: OVERSIZED_TOOL_RESULT_MAX_TOKENS });
  });

  it("preserves a lower explicit maxTokens override", () => {
    expect(
      resolveLargeToolResultStreamParams({
        messages: [createToolResult("x".repeat(OVERSIZED_TOOL_RESULT_CHARS + 1))],
        streamParams: { maxTokens: 1024, temperature: 0.2 },
      }),
    ).toEqual({ maxTokens: 1024, temperature: 0.2 });
  });

  it("leaves stream params unchanged when there is no oversized tool result", () => {
    expect(
      resolveLargeToolResultStreamParams({
        messages: [createToolResult("short")],
        streamParams: { maxTokens: 8192, temperature: 0.3 },
      }),
    ).toEqual({ maxTokens: 8192, temperature: 0.3 });
  });
});
