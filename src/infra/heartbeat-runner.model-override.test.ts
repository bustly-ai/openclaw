import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as replyModule from "../auto-reply/reply.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentMainSessionKey, resolveMainSessionKey } from "../config/sessions.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import {
  createTelegramTestPlugin,
  createWhatsAppTestPlugin,
} from "../test-utils/channel-plugin-stubs.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";
import { seedSessionStore, withTempHeartbeatSandbox } from "./heartbeat-runner.test-utils.js";

// Avoid pulling optional runtime deps during isolated runs.
vi.mock("jiti", () => ({ createJiti: () => () => ({}) }));
const { getBustlyUserLanguageMock } = vi.hoisted(() => ({
  getBustlyUserLanguageMock: vi.fn(),
}));
vi.mock("../bustly/user-language.js", () => ({
  getBustlyUserLanguage: () => getBustlyUserLanguageMock(),
}));

type SeedSessionInput = {
  lastChannel: string;
  lastTo: string;
  updatedAt?: number;
};

async function withHeartbeatFixture(
  run: (ctx: {
    tmpDir: string;
    storePath: string;
    seedSession: (sessionKey: string, input: SeedSessionInput) => Promise<void>;
  }) => Promise<unknown>,
): Promise<unknown> {
  return withTempHeartbeatSandbox(
    async ({ tmpDir, storePath }) => {
      const seedSession = async (sessionKey: string, input: SeedSessionInput) => {
        await seedSessionStore(storePath, sessionKey, {
          updatedAt: input.updatedAt,
          lastChannel: input.lastChannel,
          lastProvider: input.lastChannel,
          lastTo: input.lastTo,
        });
      };
      return run({ tmpDir, storePath, seedSession });
    },
    { prefix: "openclaw-hb-model-" },
  );
}

beforeEach(() => {
  getBustlyUserLanguageMock.mockReset();
  getBustlyUserLanguageMock.mockResolvedValue(null);
  setActivePluginRegistry(
    createTestRegistry([
      { pluginId: "whatsapp", plugin: createWhatsAppTestPlugin(), source: "test" },
      { pluginId: "telegram", plugin: createTelegramTestPlugin(), source: "test" },
    ]),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runHeartbeatOnce – heartbeat model override", () => {
  async function runDefaultsHeartbeat(params: {
    model?: string;
    suppressToolErrorWarnings?: boolean;
  }) {
    return withHeartbeatFixture(async ({ tmpDir, storePath, seedSession }) => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "whatsapp",
              model: params.model,
              suppressToolErrorWarnings: params.suppressToolErrorWarnings,
            },
          },
        },
        channels: { whatsapp: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);
      await seedSession(sessionKey, { lastChannel: "whatsapp", lastTo: "+1555" });

      const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
      replySpy.mockResolvedValue({ text: "HEARTBEAT_OK" });

      await runHeartbeatOnce({
        cfg,
        deps: {
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledTimes(1);
      return replySpy.mock.calls[0]?.[1];
    });
  }

  it("passes heartbeatModelOverride from defaults heartbeat config", async () => {
    const replyOpts = await runDefaultsHeartbeat({ model: "ollama/llama3.2:1b" });
    expect(replyOpts).toEqual(
      expect.objectContaining({
        isHeartbeat: true,
        heartbeatModelOverride: "ollama/llama3.2:1b",
        suppressToolErrorWarnings: false,
      }),
    );
  });

  it("passes suppressToolErrorWarnings when configured", async () => {
    const replyOpts = await runDefaultsHeartbeat({ suppressToolErrorWarnings: true });
    expect(replyOpts).toEqual(
      expect.objectContaining({
        isHeartbeat: true,
        suppressToolErrorWarnings: true,
      }),
    );
  });

  it("passes per-agent heartbeat model override (merged with defaults)", async () => {
    await withHeartbeatFixture(async ({ tmpDir, storePath, seedSession }) => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            heartbeat: {
              every: "30m",
              model: "openai/gpt-4o-mini",
            },
          },
          list: [
            { id: "main", default: true },
            {
              id: "ops",
              workspace: tmpDir,
              heartbeat: {
                every: "5m",
                target: "whatsapp",
                model: "ollama/llama3.2:1b",
              },
            },
          ],
        },
        channels: { whatsapp: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveAgentMainSessionKey({ cfg, agentId: "ops" });
      await seedSession(sessionKey, { lastChannel: "whatsapp", lastTo: "+1555" });

      const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
      replySpy.mockResolvedValue({ text: "HEARTBEAT_OK" });

      await runHeartbeatOnce({
        cfg,
        agentId: "ops",
        deps: {
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          isHeartbeat: true,
          heartbeatModelOverride: "ollama/llama3.2:1b",
        }),
        cfg,
      );
    });
  });

  it("does not pass heartbeatModelOverride when no heartbeat model is configured", async () => {
    const replyOpts = await runDefaultsHeartbeat({ model: undefined });
    expect(replyOpts).toEqual(
      expect.objectContaining({
        isHeartbeat: true,
      }),
    );
  });

  it("trims heartbeat model override before passing it downstream", async () => {
    const replyOpts = await runDefaultsHeartbeat({ model: "  ollama/llama3.2:1b  " });
    expect(replyOpts).toEqual(
      expect.objectContaining({
        isHeartbeat: true,
        heartbeatModelOverride: "ollama/llama3.2:1b",
      }),
    );
  });

  it("embeds heartbeat rules into the main-session message body instead of run options", async () => {
    await withHeartbeatFixture(async ({ tmpDir, storePath, seedSession }) => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "whatsapp",
            },
          },
        },
        channels: { whatsapp: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);
      await seedSession(sessionKey, { lastChannel: "whatsapp", lastTo: "+1555" });

      const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
      replySpy.mockResolvedValue({ text: "HEARTBEAT_OK" });

      await runHeartbeatOnce({
        cfg,
        deps: {
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: expect.stringContaining("Read HEARTBEAT.md"),
          SessionKey: sessionKey,
        }),
        expect.objectContaining({
          isHeartbeat: true,
        }),
        cfg,
      );
      expect(replySpy.mock.calls[0]?.[1]).not.toHaveProperty("heartbeatPrompt");
    });
  });

  it("does not inject user preferred locale outside bustly workspace context", async () => {
    await withHeartbeatFixture(async ({ tmpDir, storePath, seedSession }) => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "whatsapp",
            },
          },
        },
        channels: { whatsapp: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);
      await seedSession(sessionKey, { lastChannel: "whatsapp", lastTo: "+1555" });
      getBustlyUserLanguageMock.mockResolvedValue("zh-CN");

      const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
      replySpy.mockResolvedValue({ text: "HEARTBEAT_OK" });

      await runHeartbeatOnce({
        cfg,
        deps: {
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: expect.stringContaining("Read HEARTBEAT.md"),
          SessionKey: sessionKey,
        }),
        expect.objectContaining({
          isHeartbeat: true,
        }),
        cfg,
      );
      expect(replySpy.mock.calls[0]?.[0]).toEqual(
        expect.not.objectContaining({
          UserLocale: expect.anything(),
        }),
      );
      expect(replySpy.mock.calls[0]?.[0]?.Body).not.toContain("Preferred language for this heartbeat");
      expect(getBustlyUserLanguageMock).not.toHaveBeenCalled();
    });
  });
});
