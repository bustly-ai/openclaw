import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AgentStreamParams } from "../../commands/agent/types.js";

export const OVERSIZED_TOOL_RESULT_CHARS = 40_000;
export const OVERSIZED_TOOL_RESULT_MAX_TOKENS = 4_096;

function getToolResultTextLength(message: AgentMessage): number {
  const role = (message as { role?: unknown }).role;
  if (role !== "toolResult" && role !== "tool") {
    return 0;
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content.length;
  }
  if (!Array.isArray(content)) {
    return 0;
  }
  return content.reduce((sum, block) => {
    if (!block || typeof block !== "object") {
      return sum;
    }
    if ((block as { type?: unknown }).type !== "text") {
      return sum;
    }
    const text = (block as { text?: unknown }).text;
    return typeof text === "string" ? sum + text.length : sum;
  }, 0);
}

export function hasOversizedToolResult(messages: AgentMessage[]): boolean {
  return messages.some((message) => getToolResultTextLength(message) > OVERSIZED_TOOL_RESULT_CHARS);
}

export function resolveLargeToolResultStreamParams(params: {
  messages: AgentMessage[];
  streamParams?: AgentStreamParams;
}): AgentStreamParams | undefined {
  if (!hasOversizedToolResult(params.messages)) {
    return params.streamParams;
  }

  const currentMaxTokens =
    typeof params.streamParams?.maxTokens === "number" &&
    Number.isFinite(params.streamParams.maxTokens)
      ? params.streamParams.maxTokens
      : undefined;
  const cappedMaxTokens =
    currentMaxTokens === undefined
      ? OVERSIZED_TOOL_RESULT_MAX_TOKENS
      : Math.min(currentMaxTokens, OVERSIZED_TOOL_RESULT_MAX_TOKENS);

  return {
    ...params.streamParams,
    maxTokens: cappedMaxTokens,
  };
}
