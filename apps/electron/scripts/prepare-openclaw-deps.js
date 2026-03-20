import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const targetDir = resolve(repoRoot, "apps/electron/resources/openclaw");
const stagingDir = mkdtempSync(resolve(tmpdir(), "openclaw-deps-"));
const bustlySkillsRoot = resolve(repoRoot, "..", "bustly-skills");

rmSync(targetDir, { recursive: true, force: true });

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

const skipBustlyRuntimeInstall = String(process.env.BUSTLY_RUNTIME_SKIP_INSTALL || "")
  .trim()
  .toLowerCase();
const shouldInstallBustlyRuntime = !["1", "true", "yes", "on"].includes(skipBustlyRuntimeInstall);
if (shouldInstallBustlyRuntime) {
  const runtimeSpecs = [];
  const commerceLocalPath = resolve(bustlySkillsRoot, "skills", "commerce_core_ops");
  const adsLocalPath = resolve(bustlySkillsRoot, "skills", "ads_core_ops");

  const commerceSpec = process.env.BUSTLY_RUNTIME_COMMERCE_SPEC?.trim() ||
    (existsSync(commerceLocalPath) ? `file:${commerceLocalPath}` : "@bustly/skill-runtime-commerce-core-ops@^0.1.0");
  const adsSpec = process.env.BUSTLY_RUNTIME_ADS_SPEC?.trim() ||
    (existsSync(adsLocalPath) ? `file:${adsLocalPath}` : "@bustly/skill-runtime-ads-core-ops@^0.1.0");

  runtimeSpecs.push(commerceSpec, adsSpec);
  console.log("[prepare-openclaw-deps] Installing Bustly runtime packages:", runtimeSpecs.join(", "));
  const addRuntimeResult = spawnSync(
    "pnpm",
    ["add", "--prod", "--ignore-scripts", ...runtimeSpecs],
    { cwd: stagingDir, stdio: "inherit" },
  );
  if (addRuntimeResult.status !== 0) {
    process.exit(addRuntimeResult.status ?? 1);
  }
} else {
  console.log("[prepare-openclaw-deps] Skip Bustly runtime package install (BUSTLY_RUNTIME_SKIP_INSTALL enabled).");
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

// Ensure any symlinks are copied as real files.
// Otherwise they can point at the temp staging dir after it is removed.
cpSync(stagingDir, targetDir, { recursive: true, dereference: true });
rmSync(stagingDir, { recursive: true, force: true });
