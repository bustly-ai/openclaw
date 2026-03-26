import type { AssistantMessage } from "@mariozechner/pi-ai";
import { extractAssistantText } from "./pi-embedded-utils.js";

export const OUTPUT_LIMIT_ERROR =
  "The model hit its output limit before completing the reply. Please try again.";

export function isOutputLimitStopReason(
  message: Pick<AssistantMessage, "stopReason"> | null | undefined,
): boolean {
  return message?.stopReason === "length";
}

export function isOutputLimitWithoutReply(params: {
  provider?: string;
  assistantTexts?: string[];
  lastAssistant?: AssistantMessage;
}): boolean {
  const { lastAssistant } = params;
  if (!isOutputLimitStopReason(lastAssistant) || !lastAssistant) {
    return false;
  }
  const hasAssistantText = (params.assistantTexts ?? []).some(
    (text) => typeof text === "string" && text.trim().length > 0,
  );
  if (hasAssistantText) {
    return false;
  }
  return extractAssistantText(lastAssistant).trim().length === 0;
}

export function isOpenRouterOutputLimitWithoutReply(params: {
  provider?: string;
  assistantTexts?: string[];
  lastAssistant?: AssistantMessage;
}): boolean {
  return isOutputLimitWithoutReply(params);
}
