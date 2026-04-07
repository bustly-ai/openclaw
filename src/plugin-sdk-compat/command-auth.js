export {
  resolveSenderCommandAuthorizationWithRuntime,
} from "../../dist/plugin-sdk/index.js";

/**
 * Compatibility shim for openclaw-weixin >=2.1.x.
 * Newer plugins import this helper from openclaw/plugin-sdk/command-auth.
 * OpenClaw 2026.2.24 does not export it yet.
 */
export function resolveDirectDmAuthorizationOutcome(params) {
  if (params?.isGroup) {
    return "allowed";
  }
  if (params?.dmPolicy === "disabled") {
    return "disabled";
  }
  if (params?.dmPolicy !== "open" && !params?.senderAllowedForCommands) {
    return "unauthorized";
  }
  return "allowed";
}
