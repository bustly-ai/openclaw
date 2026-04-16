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
});
