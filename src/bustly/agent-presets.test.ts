import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadBustlyRemoteAgentMetadata,
  loadBustlyRemoteAgentPresets,
  resetBustlyRemoteAgentPresetsCache,
} from "./agent-presets.js";

describe("bustly agent presets", () => {
  let previousWorkspaceTemplateBaseUrl: string | undefined;

  beforeEach(() => {
    previousWorkspaceTemplateBaseUrl = process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL;
    delete process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL;
  });

  afterEach(() => {
    if (previousWorkspaceTemplateBaseUrl === undefined) {
      delete process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL;
    } else {
      process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL = previousWorkspaceTemplateBaseUrl;
    }
    resetBustlyRemoteAgentPresetsCache();
  });

  it("falls back to bundled preset slugs when remote env is absent", async () => {
    const presets = await loadBustlyRemoteAgentPresets();

    expect(presets.map((preset) => preset.slug)).toEqual([
      "finance",
      "customers",
      "store-ops",
      "marketing",
    ]);
  });

  it("loads remote preset config from a slug array", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(["overview", "marketing"]), { status: 200 }),
    );

    const presets = await loadBustlyRemoteAgentPresets({
      env: {
        ...process.env,
        BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/openclaw-prompts",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/openclaw-prompts/agents/config.json",
    );
    expect(presets).toEqual([
      { slug: "overview" },
      { slug: "marketing" },
    ]);
  });

  it("requires remote metadata when template base URL is missing", async () => {
    await expect(loadBustlyRemoteAgentMetadata("marketing")).rejects.toThrow(
      "Missing Bustly agent metadata at agents/marketing/.bustly-agent.json",
    );
  });

  it("loads and normalizes remote agent metadata", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            label: "Marketing",
            icon: "Web3_Avatar_1.png",
            skills: ["commerce-core-ops", "ads-core-ops", "ads-core-ops"],
            useCases: [
              {
                label: "Campaign Diagnosis",
                prompt: "Find the wasted spend.",
              },
            ],
          }),
          {
            status: 200,
          },
        ),
    );

    const metadata = await loadBustlyRemoteAgentMetadata("marketing", {
      env: {
        ...process.env,
        BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/openclaw-prompts",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/openclaw-prompts/agents/marketing/.bustly-agent.json",
    );
    expect(metadata).toEqual({
      label: "Marketing",
      icon: "Web3_Avatar_1.png",
      skills: ["ads-core-ops", "commerce-core-ops"],
      useCases: [
        {
          label: "Campaign Diagnosis",
          prompt: "Find the wasted spend.",
        },
      ],
    });
  });

  it("rejects agent metadata that omits useCases", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            label: "Customers",
            icon: "Web3_Avatar_3.png",
            skills: ["commerce-core-ops"],
          }),
          { status: 200 },
        ),
    );

    await expect(
      loadBustlyRemoteAgentMetadata("customers", {
        env: {
          ...process.env,
          BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/openclaw-prompts",
        },
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow("must include useCases");
  });
});
