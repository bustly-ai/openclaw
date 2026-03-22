import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { PluginRuntime } from "../plugins/runtime/types.js";
import {
  resolveDirectDmAuthorizationOutcome,
  resolveSenderCommandAuthorizationWithRuntime,
} from "./command-auth.js";

describe("resolveSenderCommandAuthorizationWithRuntime", () => {
  it("adapts runtime callbacks to the legacy authorization helper", async () => {
    const readAllowFromStore = vi.fn(async () => ["store-user"]);
    const runtime = {
      shouldComputeCommandAuthorized: vi.fn(() => true),
      resolveCommandAuthorizedFromAuthorizers: vi.fn(({ authorizers }) =>
        authorizers.every((entry: { configured: boolean; allowed: boolean }) =>
          !entry.configured || entry.allowed,
        ),
      ),
    } satisfies Pick<PluginRuntime["channel"]["commands"],
      "shouldComputeCommandAuthorized" | "resolveCommandAuthorizedFromAuthorizers">;

    const result = await resolveSenderCommandAuthorizationWithRuntime({
      cfg: {} as OpenClawConfig,
      rawBody: "/status",
      isGroup: false,
      dmPolicy: "pairing",
      configuredAllowFrom: [],
      configuredGroupAllowFrom: [],
      senderId: "store-user",
      isSenderAllowed: (senderId, allowFrom) => allowFrom.includes(senderId),
      readAllowFromStore,
      runtime,
    });

    expect(runtime.shouldComputeCommandAuthorized).toHaveBeenCalledWith("/status", {});
    expect(runtime.resolveCommandAuthorizedFromAuthorizers).toHaveBeenCalledWith({
      useAccessGroups: true,
      authorizers: [{ configured: true, allowed: true }],
    });
    expect(result).toMatchObject({
      shouldComputeAuth: true,
      effectiveAllowFrom: ["store-user"],
      senderAllowedForCommands: true,
      commandAuthorized: true,
    });
  });
});

describe("resolveDirectDmAuthorizationOutcome", () => {
  it("returns disabled when dm handling is disabled", () => {
    expect(
      resolveDirectDmAuthorizationOutcome({
        isGroup: false,
        dmPolicy: "disabled",
        senderAllowedForCommands: true,
      }),
    ).toBe("disabled");
  });

  it("returns authorized for open policy", () => {
    expect(
      resolveDirectDmAuthorizationOutcome({
        isGroup: false,
        dmPolicy: "open",
        senderAllowedForCommands: false,
      }),
    ).toBe("authorized");
  });

  it("returns unauthorized when sender is not allowed", () => {
    expect(
      resolveDirectDmAuthorizationOutcome({
        isGroup: false,
        dmPolicy: "pairing",
        senderAllowedForCommands: false,
      }),
    ).toBe("unauthorized");
  });
});
