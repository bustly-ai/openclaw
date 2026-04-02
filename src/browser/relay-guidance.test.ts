import { describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import type { ResolvedBrowserProfile } from "./config.js";
import { buildRelayGuidanceMessage } from "./relay-guidance.js";

function makeExtensionProfile(): ResolvedBrowserProfile {
  return {
    name: "chrome",
    cdpPort: 18002,
    cdpUrl: "http://127.0.0.1:18002",
    cdpHost: "127.0.0.1",
    cdpIsLoopback: true,
    color: "#00AA00",
    driver: "extension",
  };
}

describe("relay guidance", () => {
  it("includes download url + setup checklist for extension relay guidance", () => {
    withEnv(
      {
        BUSTLY_BROWSER_RELAY_DOWNLOAD_URL: "https://downloads.example.com/bustly-relay.zip",
      },
      () => {
        const message = buildRelayGuidanceMessage({
          profile: makeExtensionProfile(),
          kind: "extension_not_connected",
        });

        expect(message).toContain("Local Bustly relay service is reachable");
        expect(message).toContain("Relay setup checklist:");
        expect(message).toContain("downloads.example.com/bustly-relay.zip");
        expect(message).toContain("chrome://extensions");
        expect(message).toContain("Load unpacked");
        expect(message).toContain("gateway.auth.token");
        expect(message).toContain("openclaw browser extension install");
      },
    );
  });
});
