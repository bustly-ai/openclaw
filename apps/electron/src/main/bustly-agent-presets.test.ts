import { afterEach, describe, expect, it, vi } from "vitest";

const { writeMainWarn } = vi.hoisted(() => ({
  writeMainWarn: vi.fn(),
}));

const { mainHttpFetch } = vi.hoisted(() => ({
  mainHttpFetch: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  writeMainWarn,
}));

vi.mock("./http-client.js", () => ({
  mainHttpFetch,
}));

import {
  loadEnabledBustlyRemoteAgentPresets,
  resetBustlyRemoteAgentPresetsCache,
} from "./bustly-agent-presets.js";

describe("loadEnabledBustlyRemoteAgentPresets", () => {
  afterEach(() => {
    resetBustlyRemoteAgentPresetsCache();
    mainHttpFetch.mockReset();
    writeMainWarn.mockReset();
  });

  it("sorts remote presets by order before returning them", async () => {
    mainHttpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        agents: [
          { slug: "marketing", label: "Marketing", icon: "TrendUp", order: 40, enabled: true },
          { slug: "overview", label: "Overview", icon: "Robot", order: 0, enabled: true, isMain: true },
          { slug: "finance", label: "Finance", icon: "Wallet", order: 10, enabled: true },
          { slug: "customers", label: "Customers", icon: "Users", order: 20, enabled: true },
          { slug: "store-ops", label: "Store Ops", icon: "Storefront", order: 30, enabled: true },
        ],
      }),
    });

    const presets = await loadEnabledBustlyRemoteAgentPresets({
      BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/openclaw-prompts",
    });

    expect(presets.map((preset) => preset.slug)).toEqual([
      "overview",
      "finance",
      "customers",
      "store-ops",
      "marketing",
    ]);
    expect(mainHttpFetch).toHaveBeenCalledWith(
      "https://example.com/openclaw-prompts/agents/config.json",
      expect.objectContaining({
        label: "Bustly Agent Presets",
        timeoutMs: 15_000,
      }),
    );
  });

  it("uses the bundled fallback presets in the same creation order", async () => {
    const presets = await loadEnabledBustlyRemoteAgentPresets({});

    expect(presets.map((preset) => preset.slug)).toEqual([
      "overview",
      "finance",
      "customers",
      "store-ops",
      "marketing",
    ]);
    expect(writeMainWarn).toHaveBeenCalled();
  });
});
