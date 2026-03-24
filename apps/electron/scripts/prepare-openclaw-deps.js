import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const targetDir = resolve(repoRoot, "apps/electron/resources/openclaw");
const bustlySkillsTargetDir = resolve(repoRoot, "apps/electron/resources/bustly-skills");
const stagingDir = mkdtempSync(resolve(tmpdir(), "openclaw-deps-"));
const bustlySkillsRoot = resolve(repoRoot, "bustly-skills");

rmSync(targetDir, { recursive: true, force: true });
rmSync(bustlySkillsTargetDir, { recursive: true, force: true });

console.log("[prepare-openclaw-deps] Building root OpenClaw package artifacts.");
const buildResult = spawnSync(
  "pnpm",
  ["build"],
  { cwd: repoRoot, stdio: "inherit" },
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const deployResult = spawnSync(
  "pnpm",
  ["deploy", "--filter", "openclaw", "--prod", "--legacy", stagingDir],
  { cwd: repoRoot, stdio: "inherit" },
);

if (deployResult.status !== 0) {
  process.exit(deployResult.status ?? 1);
}

const nodeModulesDir = resolve(stagingDir, "node_modules");
if (!existsSync(nodeModulesDir)) {
  console.error("[prepare-openclaw-deps] node_modules not found after deploy.");
  process.exit(1);
}

// Replace pnpm virtual store layout with a hoisted (non-symlink) install.
rmSync(nodeModulesDir, { recursive: true, force: true });
const installResult = spawnSync(
  "pnpm",
  ["install", "--prod", "--node-linker=hoisted", "--ignore-scripts"],
  { cwd: stagingDir, stdio: "inherit" },
);
if (installResult.status !== 0) {
  process.exit(installResult.status ?? 1);
}

const removeBinDirs = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".bin") {
        rmSync(fullPath, { recursive: true, force: true });
        continue;
      }
      removeBinDirs(fullPath);
    }
  }
};

removeBinDirs(resolve(stagingDir, "node_modules"));

const pruneDevDependencies = () => {
  const packageJsonPath = resolve(stagingDir, "package.json");
  const raw = readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(raw);
  const devDeps = Object.keys(pkg.devDependencies || {});
  if (devDeps.length === 0) {
    return;
  }

  for (const name of devDeps) {
    const devPath = resolve(stagingDir, "node_modules", name);
    if (existsSync(devPath)) {
      rmSync(devPath, { recursive: true, force: true });
    }
  }
};

pruneDevDependencies();

const pruneNodeModules = () => {
  const nodeModulesRoot = resolve(stagingDir, "node_modules");
  const removableDirNames = new Set([
    ".ignored",
  ]);
  const removableFileNames = new Set([
    ".DS_Store",
  ]);
  const removableExtensions = new Set([
    ".map",
    ".md",
    ".markdown",
  ]);

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (removableDirNames.has(entry.name)) {
          rmSync(fullPath, { recursive: true, force: true });
          continue;
        }
        visit(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (removableFileNames.has(entry.name) || removableExtensions.has(extname(lowerName))) {
        rmSync(fullPath, { force: true });
      }
    }
  };

  visit(nodeModulesRoot);
};

pruneNodeModules();

// Ensure any symlinks are copied as real files.
// Otherwise they can point at the temp staging dir after it is removed.
cpSync(stagingDir, targetDir, { recursive: true, dereference: true });

const rewriteStagingSymlinks = () => {
  const targetRoot = resolve(targetDir);
  const targetRootReal = realpathSync.native(targetRoot);
  const stagingPrefixes = [
    resolve(stagingDir),
    realpathSync.native(stagingDir),
  ];

  const mapTargetIntoBundle = (symlinkTarget) => {
    for (const prefix of stagingPrefixes) {
      if (symlinkTarget === prefix) {
        return targetRootReal;
      }
      if (symlinkTarget.startsWith(`${prefix}/`)) {
        return resolve(targetRootReal, symlinkTarget.slice(prefix.length + 1));
      }
    }
    return null;
  };

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        const originalTarget = readlinkSync(fullPath);
        const mappedTarget = mapTargetIntoBundle(originalTarget);
        if (!mappedTarget) {
          continue;
        }
        const relativeTarget = relative(dirname(fullPath), mappedTarget) || ".";
        unlinkSync(fullPath);
        symlinkSync(relativeTarget, fullPath);
        continue;
      }
      if (stat.isDirectory()) {
        visit(fullPath);
      }
    }
  };

  visit(targetRoot);
};

const assertNoStagingSymlinksRemain = () => {
  const stagingPrefixes = [
    resolve(stagingDir),
    realpathSync.native(stagingDir),
  ];
  const staleLinks = [];

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        const symlinkTarget = readlinkSync(fullPath);
        if (stagingPrefixes.some((prefix) => symlinkTarget === prefix || symlinkTarget.startsWith(`${prefix}/`))) {
          staleLinks.push(`${fullPath} -> ${symlinkTarget}`);
        }
        continue;
      }
      if (stat.isDirectory()) {
        visit(fullPath);
      }
    }
  };

  visit(targetDir);
  if (staleLinks.length > 0) {
    console.error("[prepare-openclaw-deps] Found copied symlinks that still point at stagingDir.");
    for (const link of staleLinks.slice(0, 20)) {
      console.error(`  ${link}`);
    }
    process.exit(1);
  }
};

rewriteStagingSymlinks();
assertNoStagingSymlinksRemain();

if (existsSync(bustlySkillsRoot)) {
  console.log(`[prepare-openclaw-deps] Copying bustly-skills bundle from ${bustlySkillsRoot}.`);
  cpSync(bustlySkillsRoot, bustlySkillsTargetDir, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const relative = source.slice(bustlySkillsRoot.length).replace(/^[/\\]/, "");
      if (!relative) {
        return true;
      }
      const firstSegment = relative.split(/[/\\]/)[0];
      return ["README.md", "package.json", "bin", "scripts", "skills", "platforms"].includes(firstSegment);
    },
  });
} else {
  console.error(`[prepare-openclaw-deps] Missing bustly-skills submodule: ${bustlySkillsRoot}`);
  process.exit(1);
}

rmSync(stagingDir, { recursive: true, force: true });
