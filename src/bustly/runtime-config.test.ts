import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  applyBustlyOnlyConfig,
  BUSTLY_DEFAULT_HEARTBEAT_MODEL_REF,
  normalizeBustlyModelRef,
  syncBustlyConfigFile,
} from "./runtime-config.js";

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => ({
    user: {
      workspaceId: "workspace-live",
    },
  })),
}));

function baseConfig(): OpenClawConfig {
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-4.1",
          fallbacks: ["openai/gpt-4.1-mini"],
        },
      },
    },
    models: {
      providers: {
        openai: {
          api: "openai-completions",
          auth: "api_key",
        },
      },
    },
  };
}

describe("normalizeBustlyModelRef", () => {
  it("normalizes provider-prefixed, raw route key, and shorthand inputs", () => {
    expect(normalizeBustlyModelRef("bustly/chat.standard")).toBe("bustly/chat.standard");
    expect(normalizeBustlyModelRef("chat.advanced")).toBe("bustly/chat.advanced");
    expect(normalizeBustlyModelRef("pro")).toBe("bustly/chat.advanced");
    expect(normalizeBustlyModelRef("lite")).toBe("bustly/chat.standard");
  });
});

describe("applyBustlyOnlyConfig", () => {
  it("forces bustly-only provider config and preserves model fallbacks", () => {
    const next = applyBustlyOnlyConfig(baseConfig(), {
      selectedModelInput: "chat.standard",
      userAgent: "unit-test-agent",
    });
    const defaultsModel = next.agents?.defaults?.model;
    if (!defaultsModel || typeof defaultsModel === "string") {
      throw new Error("expected object model defaults");
    }
    expect(defaultsModel.primary).toBe("bustly/chat.standard");
    expect(defaultsModel.fallbacks).toEqual(["openai/gpt-4.1-mini"]);
    expect(Object.keys(next.models?.providers ?? {})).toEqual(["bustly"]);
    expect(next.models?.providers?.bustly?.headers).toMatchObject({
      "User-Agent": "unit-test-agent",
      "X-Workspace-Id": "workspace-live",
    });
    expect(next.agents?.defaults?.heartbeat?.model).toBe(BUSTLY_DEFAULT_HEARTBEAT_MODEL_REF);
  });
});

describe("syncBustlyConfigFile", () => {
  it("writes config when bustly sync changes the file", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "openclaw-bustly-config-"));
    const configPath = path.join(tempDir, "openclaw.json");
    writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2));
    const result = syncBustlyConfigFile(configPath, {
      selectedModelInput: "chat.ultra",
      userAgent: "sync-agent",
    });
    expect(result.changed).toBe(true);
    const synced = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    const model = synced.agents?.defaults?.model as { primary?: string };
    expect(model?.primary).toBe("bustly/chat.ultra");
    expect(synced.models?.providers?.bustly?.headers?.["User-Agent"]).toBe("sync-agent");
  });
});
