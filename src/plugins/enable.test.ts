import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { enablePluginInConfig } from "./enable.js";

describe("enablePluginInConfig", () => {
  it("enables a plugin entry", () => {
    const cfg: OpenClawConfig = {};
    const result = enablePluginInConfig(cfg, "memory-core");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.entries?.["memory-core"]?.enabled).toBe(true);
  });

  it("adds plugin to allowlist when allowlist is configured", () => {
    const cfg: OpenClawConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "slack");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "slack"]);
  });

  it("refuses enable when plugin is denylisted", () => {
    const cfg: OpenClawConfig = {
      plugins: {
        deny: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "memory-core");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("writes built-in channels to channels.<id>.enabled and plugins.entries", () => {
    const cfg: OpenClawConfig = {};
    const result = enablePluginInConfig(cfg, "slack");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.slack?.enabled).toBe(true);
    expect(result.config.plugins?.entries?.slack?.enabled).toBe(true);
  });

  it("adds built-in channel id to allowlist when allowlist is configured", () => {
    const cfg: OpenClawConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "slack");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.slack?.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "slack"]);
  });

  it("re-enables built-in channels after explicit plugin-level disable", () => {
    const cfg: OpenClawConfig = {
      channels: {
        slack: {
          enabled: true,
        },
      },
      plugins: {
        entries: {
          slack: {
            enabled: false,
          },
        },
      },
    };
    const result = enablePluginInConfig(cfg, "slack");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.slack?.enabled).toBe(true);
    expect(result.config.plugins?.entries?.slack?.enabled).toBe(true);
  });
});
