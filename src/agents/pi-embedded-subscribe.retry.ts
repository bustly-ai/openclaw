import { isContextOverflowError } from "./pi-embedded-helpers/errors.js";

const RETRYABLE_ASSISTANT_ERROR_RE =
  /overloaded|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server error|internal error|connection.?error|connection.?refused|other side closed|fetch failed|upstream.?connect|reset before headers|terminated|retry delay/i;

export function isRetryableAssistantError(
  message:
    | {
        stopReason?: unknown;
        errorMessage?: unknown;
      }
    | null
    | undefined,
): boolean {
  if (message?.stopReason !== "error" || typeof message.errorMessage !== "string") {
    return false;
  }
  const errorMessage = message.errorMessage.trim();
  if (!errorMessage) {
    return false;
  }
  if (isContextOverflowError(errorMessage)) {
    return false;
  }
  return RETRYABLE_ASSISTANT_ERROR_RE.test(errorMessage);
}
