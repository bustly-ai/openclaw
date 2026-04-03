import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as sdk from "./index.js";

describe("plugin-sdk exports", () => {
  it("does not expose runtime modules", () => {
    const forbidden = [
      "chunkMarkdownText",
      "chunkText",
      "resolveTextChunkLimit",
      "hasControlCommand",
      "isControlCommandMessage",
      "shouldComputeCommandAuthorized",
      "shouldHandleTextCommands",
      "buildMentionRegexes",
      "matchesMentionPatterns",
      "resolveStateDir",
      "loadConfig",
      "writeConfigFile",
      "runCommandWithTimeout",
      "enqueueSystemEvent",
      "fetchRemoteMedia",
      "saveMediaBuffer",
      "formatAgentEnvelope",
      "buildPairingReply",
      "resolveAgentRoute",
      "dispatchReplyFromConfig",
      "createReplyDispatcherWithTyping",
      "dispatchReplyWithBufferedBlockDispatcher",
      "resolveCommandAuthorizedFromAuthorizers",
      "monitorSlackProvider",
      "monitorTelegramProvider",
      "monitorIMessageProvider",
      "monitorSignalProvider",
      "sendMessageSlack",
      "sendMessageTelegram",
      "sendMessageIMessage",
      "sendMessageSignal",
      "sendMessageWhatsApp",
      "probeSlack",
      "probeTelegram",
      "probeIMessage",
      "probeSignal",
    ];

    for (const key of forbidden) {
      expect(Object.prototype.hasOwnProperty.call(sdk, key)).toBe(false);
    }
  });

  it("publishes compat exports from dist", () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      exports: Record<string, string | { default?: string }>;
    };

    expect(pkg.exports["./plugin-sdk"]).toEqual({
      types: "./dist/plugin-sdk/index.d.ts",
      default: "./dist/plugin-sdk-compat/index.js",
    });

    expect(pkg.exports["./plugin-sdk/channel-status"]).toEqual({
      types: "./dist/plugin-sdk-compat/channel-status.d.ts",
      default: "./dist/plugin-sdk-compat/channel-status.js",
    });

    expect(pkg.exports["./plugin-sdk/config-runtime"]).toEqual({
      types: "./dist/plugin-sdk-compat/config-runtime.d.ts",
      default: "./dist/plugin-sdk-compat/config-runtime.js",
    });
  });
});
