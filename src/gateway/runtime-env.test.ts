import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGatewayRuntimeEnv,
  resolveGatewayRuntimeBundledPluginsDir,
  resolveGatewayRuntimeBundledSkillsDir,
} from "./runtime-env.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

describe("gateway runtime env", () => {
  it("resolves bundled skills from the bustly-skills checkout in repo layouts", () => {
    const bundledSkillsDir = resolveGatewayRuntimeBundledSkillsDir({
      cwd: repoRoot,
      moduleUrl: import.meta.url,
      env: {},
    });

    expect(bundledSkillsDir).toBe(path.join(repoRoot, "bustly-skills", "skills"));
  });

  it("resolves bundled plugins from the repo extensions dir", () => {
    const bundledPluginsDir = resolveGatewayRuntimeBundledPluginsDir({
      cwd: repoRoot,
      moduleUrl: import.meta.url,
      env: {},
    });

    expect(bundledPluginsDir).toBe(path.join(repoRoot, "extensions"));
  });

  it("builds a shared env with bundled resource overrides", () => {
    const env = buildGatewayRuntimeEnv({
      env: {
        PATH: "/usr/bin",
        OPENCLAW_EXEC_PATH_PREPEND: "/existing/bin",
      },
      cwd: repoRoot,
      moduleUrl: import.meta.url,
      stateDir: "/tmp/openclaw-state",
      configPath: "/tmp/openclaw-state/openclaw.json",
      preferBundledPlugins: true,
      pathPrepend: ["/runtime/bin"],
      execPathPrepend: ["/runtime/bin"],
    });

    expect(env.OPENCLAW_BUNDLED_SKILLS_DIR).toBe(path.join(repoRoot, "bustly-skills", "skills"));
    expect(env.OPENCLAW_BUNDLED_PLUGINS_DIR).toBe(path.join(repoRoot, "extensions"));
    expect(env.OPENCLAW_PREFER_BUNDLED_PLUGINS).toBe("1");
    expect(env.OPENCLAW_STATE_DIR).toBe("/tmp/openclaw-state");
    expect(env.OPENCLAW_CONFIG_PATH).toBe("/tmp/openclaw-state/openclaw.json");
    expect(env.PATH).toBe(`/runtime/bin${path.delimiter}/usr/bin`);
    expect(env.OPENCLAW_EXEC_PATH_PREPEND).toBe(
      `/runtime/bin${path.delimiter}/existing/bin`,
    );
  });
});
