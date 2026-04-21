import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type PersistentAssetSpec = {
  assetKey: string;
  path: string;
  storage: "efs" | "object-storage";
  kind?: "directory" | "file";
};

function parseJsonArray<T>(raw: string | undefined): T[] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParent(targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function moveChildren(sourceDir: string, targetDir: string): Promise<void> {
  const entries = await fs.readdir(sourceDir);
  for (const entry of entries) {
    const fromPath = path.join(sourceDir, entry);
    const toPath = path.join(targetDir, entry);
    if (await pathExists(toPath)) {
      continue;
    }
    await fs.rename(fromPath, toPath);
  }
}

async function migratePathIntoTarget(sourcePath: string, targetPath: string): Promise<void> {
  if (!(await pathExists(sourcePath))) {
    return;
  }

  const sourceStat = await fs.lstat(sourcePath);
  if (sourceStat.isSymbolicLink()) {
    return;
  }

  await ensureParent(targetPath);

  if (sourceStat.isDirectory()) {
    await fs.mkdir(targetPath, { recursive: true });
    await moveChildren(sourcePath, targetPath);
    await fs.rm(sourcePath, { recursive: true, force: true });
    return;
  }

  if (!(await pathExists(targetPath))) {
    await fs.rename(sourcePath, targetPath);
    return;
  }

  await fs.rm(sourcePath, { force: true });
}

async function ensureSymlink(sourcePath: string, targetPath: string): Promise<void> {
  await ensureParent(sourcePath);
  if (await pathExists(sourcePath)) {
    const stat = await fs.lstat(sourcePath);
    if (stat.isSymbolicLink()) {
      const current = await fs.readlink(sourcePath);
      const resolvedCurrent = path.resolve(path.dirname(sourcePath), current);
      if (resolvedCurrent === path.resolve(targetPath)) {
        return;
      }
      await fs.rm(sourcePath, { force: true });
    } else {
      await migratePathIntoTarget(sourcePath, targetPath);
    }
  }

  const relativeTarget = path.relative(path.dirname(sourcePath), targetPath) || ".";
  await fs.symlink(relativeTarget, sourcePath);
}

export async function applyPersistenceLayout(params: {
  efsMountRoot?: string | null;
  persistentAssets?: PersistentAssetSpec[];
  ephemeralPaths?: string[];
}): Promise<void> {
  const efsMountRoot = params.efsMountRoot?.trim();
  if (!efsMountRoot) {
    return;
  }

  await fs.mkdir(efsMountRoot, { recursive: true });
  const persistentAssets = (params.persistentAssets ?? []).filter(
    (asset) => asset.storage === "efs" && asset.assetKey.trim() && path.isAbsolute(asset.path),
  );
  const mappedRoots: string[] = [];
  for (const asset of persistentAssets) {
    const assetKind = asset.kind ?? "directory";
    const mappedParent = mappedRoots.find((root) => {
      const relative = path.relative(root, asset.path);
      return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    });
    if (mappedParent) {
      if (assetKind === "directory") {
        await fs.mkdir(asset.path, { recursive: true });
      } else {
        await ensureParent(asset.path);
      }
      continue;
    }
    const targetPath = path.join(efsMountRoot, "persistent", asset.assetKey);
    if (assetKind === "directory") {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      await ensureParent(targetPath);
    }
    await ensureSymlink(asset.path, targetPath);
    if (assetKind === "directory") {
      mappedRoots.push(asset.path);
    }
  }

  for (const ephemeralPath of params.ephemeralPaths ?? []) {
    if (!path.isAbsolute(ephemeralPath)) {
      continue;
    }
    await fs.mkdir(ephemeralPath, { recursive: true });
  }
}

export async function applyPersistenceLayoutFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await applyPersistenceLayout({
    efsMountRoot: env.OPENCLAW_EFS_MOUNT_ROOT,
    persistentAssets: parseJsonArray<PersistentAssetSpec>(env.OPENCLAW_PERSISTENT_ASSET_PATHS_JSON),
    ephemeralPaths: parseJsonArray<string>(env.OPENCLAW_EPHEMERAL_PATHS_JSON),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await applyPersistenceLayoutFromEnv(process.env);
}
