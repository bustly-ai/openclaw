import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPersistenceLayout } from "./persistence-layout.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-persist-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("applyPersistenceLayout", () => {
  it("maps declared EFS-backed assets into the mount root", async () => {
    const root = await makeTempRoot();
    const efsMountRoot = path.join(root, "mnt", "bustly");
    const workspaceDir = path.join(root, "workspace");
    const memoryDir = path.join(workspaceDir, ".memory");
    const cacheDir = path.join(workspaceDir, ".cache");

    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(path.join(memoryDir, "memory.md"), "remember me");

    await applyPersistenceLayout({
      efsMountRoot,
      persistentAssets: [
        { assetKey: "workspace-files", path: workspaceDir, storage: "efs" },
        { assetKey: "memory", path: memoryDir, storage: "efs" },
      ],
      ephemeralPaths: [cacheDir],
    });

    const workspaceLink = await fs.readlink(workspaceDir);
    expect(path.resolve(path.dirname(workspaceDir), workspaceLink)).toBe(
      path.join(efsMountRoot, "persistent", "workspace-files"),
    );
    expect(
      await fs.readFile(
        path.join(efsMountRoot, "persistent", "workspace-files", ".memory", "memory.md"),
        "utf8",
      ),
    ).toBe("remember me");
    expect(await fs.readFile(path.join(memoryDir, "memory.md"), "utf8")).toBe("remember me");
    await expect(fs.stat(memoryDir)).resolves.toBeTruthy();
    expect((await fs.lstat(memoryDir)).isSymbolicLink()).toBe(false);
    await expect(fs.stat(cacheDir)).resolves.toBeTruthy();
  });

  it("maps declared file assets as files rather than directories", async () => {
    const root = await makeTempRoot();
    const efsMountRoot = path.join(root, "mnt", "bustly");
    const stateDir = path.join(root, ".bustly");
    const configPath = path.join(stateDir, "openclaw.json");
    const oauthPath = path.join(stateDir, "bustlyOauth.json");

    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(configPath, '{"gateway":true}');
    await fs.writeFile(oauthPath, '{"oauth":true}');

    await applyPersistenceLayout({
      efsMountRoot,
      persistentAssets: [
        {
          assetKey: "gateway-config",
          path: configPath,
          storage: "efs",
          kind: "file",
        },
        {
          assetKey: "oauth-state",
          path: oauthPath,
          storage: "efs",
          kind: "file",
        },
      ],
      ephemeralPaths: [],
    });

    expect((await fs.lstat(configPath)).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(oauthPath)).isSymbolicLink()).toBe(true);
    expect(await fs.readFile(path.join(efsMountRoot, "persistent", "gateway-config"), "utf8")).toBe(
      '{"gateway":true}',
    );
    expect(await fs.readFile(path.join(efsMountRoot, "persistent", "oauth-state"), "utf8")).toBe(
      '{"oauth":true}',
    );
  });

  it("ignores non-EFS assets and relative paths", async () => {
    const root = await makeTempRoot();
    const efsMountRoot = path.join(root, "mnt", "bustly");
    const workspaceDir = path.join(root, "workspace");

    await applyPersistenceLayout({
      efsMountRoot,
      persistentAssets: [
        { assetKey: "archive", path: "/workspace/archive", storage: "object-storage" },
        { assetKey: "relative", path: "workspace", storage: "efs" },
      ],
      ephemeralPaths: [],
    });

    await expect(fs.stat(path.join(efsMountRoot, "persistent", "archive"))).rejects.toThrow();
    await expect(fs.stat(workspaceDir)).rejects.toThrow();
  });

  it("supports a durable ~/.bustly root with nested ephemeral overrides", async () => {
    const root = await makeTempRoot();
    const efsMountRoot = path.join(root, "mnt", "bustly");
    const stateDir = path.join(root, "home", "node", ".bustly");
    const sessionDir = path.join(stateDir, "agents", "default", "sessions");
    const logDir = path.join(stateDir, "logs");
    const browserDir = path.join(stateDir, "browser");

    await fs.mkdir(sessionDir, { recursive: true });
    await fs.mkdir(logDir, { recursive: true });
    await fs.mkdir(browserDir, { recursive: true });
    await fs.writeFile(path.join(sessionDir, "sessions.json"), '{"count":1}');
    await fs.writeFile(path.join(logDir, "gateway.log"), "old-log");
    await fs.writeFile(path.join(browserDir, "cache.txt"), "old-browser");

    await applyPersistenceLayout({
      efsMountRoot,
      persistentAssets: [
        {
          assetKey: "state-dir",
          path: stateDir,
          storage: "efs",
          kind: "directory",
        },
      ],
      ephemeralPaths: [logDir, browserDir],
    });

    const stateLink = await fs.readlink(stateDir);
    const persistentStateDir = path.join(efsMountRoot, "persistent", "state-dir");
    expect(path.resolve(path.dirname(stateDir), stateLink)).toBe(persistentStateDir);

    expect(await fs.readFile(path.join(sessionDir, "sessions.json"), "utf8")).toBe('{"count":1}');
    await expect(
      fs.stat(path.join(persistentStateDir, "agents", "default", "sessions")),
    ).resolves.toBeTruthy();

    const persistentLogEntry = path.join(persistentStateDir, "logs");
    const persistentBrowserEntry = path.join(persistentStateDir, "browser");
    expect((await fs.lstat(persistentLogEntry)).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(persistentBrowserEntry)).isSymbolicLink()).toBe(true);

    const resolvedLogDir = await fs.realpath(logDir);
    const resolvedBrowserDir = await fs.realpath(browserDir);

    expect(resolvedLogDir).toContain(`${path.sep}openclaw-ephemeral-overrides${path.sep}`);
    expect(resolvedBrowserDir).toContain(`${path.sep}openclaw-ephemeral-overrides${path.sep}`);

    await fs.writeFile(path.join(logDir, "gateway.log"), "fresh-log");
    await fs.writeFile(path.join(browserDir, "cache.txt"), "fresh-browser");

    expect(await fs.readFile(path.join(logDir, "gateway.log"), "utf8")).toBe("fresh-log");
    expect(await fs.readFile(path.join(browserDir, "cache.txt"), "utf8")).toBe("fresh-browser");
    await expect(fs.stat(path.join(persistentStateDir, "logs", "gateway.log"))).rejects.toThrow();
    await expect(fs.stat(path.join(persistentStateDir, "browser", "cache.txt"))).rejects.toThrow();
  });
});
