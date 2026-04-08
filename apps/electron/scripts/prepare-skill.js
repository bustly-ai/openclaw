import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const bustlySkillsRoot = resolve(repoRoot, "bustly-skills");
const sourceSkillsDir = resolve(bustlySkillsRoot, "skills");
const targetSkillsDir = resolve(repoRoot, "skills");
const electronBustlySkillsTargetDir = resolve(repoRoot, "apps", "electron", "resources", "bustly-skills");
const DEFAULT_ENABLED_MANIFEST_NAME = ".bustly-default-enabled.json";

function fail(message) {
  console.error(`[prepare-skill] ${message}`);
  process.exit(1);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout ?? "";
}

function syncBustlySkillsBranch(branch) {
  const target = String(branch || "").trim();
  if (!target) {
    return;
  }
  console.log(`[prepare-skill] Syncing bustly-skills to latest origin/${target}`);
  run("git", ["fetch", "origin", target], bustlySkillsRoot);
  run("git", ["checkout", "-B", target, `origin/${target}`], bustlySkillsRoot);
}

function hasRemoteBranch(branch) {
  const target = String(branch || "").trim();
  if (!target) {
    return false;
  }
  return (
    runCapture("git", ["ls-remote", "--exit-code", "--heads", "origin", target], bustlySkillsRoot)
    !== null
  );
}

function resolveDefaultSkillsBranch() {
  const upstream = runCapture(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    bustlySkillsRoot,
  )
    ?.trim();
  if (upstream?.startsWith("origin/")) {
    return upstream.slice("origin/".length);
  }

  const current = runCapture("git", ["branch", "--show-current"], bustlySkillsRoot)?.trim();
  if (current && current !== "HEAD" && hasRemoteBranch(current)) {
    return current;
  }

  const remoteHead = runCapture(
    "git",
    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    bustlySkillsRoot,
  )
    ?.trim();
  if (remoteHead?.startsWith("origin/")) {
    return remoteHead.slice("origin/".length);
  }

  return "main";
}

function parseArgs(argv) {
  const options = {
    skillsBranch: process.env.BUSTLY_SKILLS_BRANCH?.trim() || "",
    skipSkillsSync:
      process.env.BUSTLY_SKILLS_SKIP_SYNC === "1"
      || process.env.BUSTLY_SKILLS_SKIP_SYNC === "true",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm run prepare-skill [--skills-branch <branch>] [--no-skills-sync]");
      process.exit(0);
    }
    if (arg === "--no-skills-sync") {
      options.skipSkillsSync = true;
      continue;
    }
    if (arg === "--skills-sync") {
      options.skipSkillsSync = false;
      continue;
    }
    if (arg === "--skills-branch") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        fail("Missing value for --skills-branch");
      }
      options.skillsBranch = value.trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--skills-branch=")) {
      options.skillsBranch = arg.split("=", 2)[1]?.trim() || "";
      continue;
    }
    if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    }
    fail(`Unexpected argument: ${arg}`);
  }

  const hasLocalCheckout = existsSync(bustlySkillsRoot) && existsSync(sourceSkillsDir);
  if (hasLocalCheckout) {
    console.log("[prepare-skill] Using existing local bustly-skills checkout");
  } else {
    console.log("[prepare-skill] Initializing bustly-skills submodule");
    run("git", ["submodule", "update", "--init", "bustly-skills"], repoRoot);
  }

  if (options.skipSkillsSync) {
    console.log("[prepare-skill] Skipping bustly-skills remote sync (--no-skills-sync)");
    return options;
  }

  const targetBranch = options.skillsBranch || resolveDefaultSkillsBranch();
  if (targetBranch) {
    options.skillsBranch = targetBranch;
    syncBustlySkillsBranch(targetBranch);
  } else {
    console.log("[prepare-skill] Could not resolve a branch for bustly-skills sync; continuing");
  }
  return options;
}

function listDirectories(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name && !name.startsWith("."))
    .sort((left, right) => left.localeCompare(right));
}

function resolveBuiltInSkillDirs() {
  const tracked = runCapture("git", ["ls-tree", "-d", "--name-only", "HEAD:skills"], repoRoot)
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("."));
  if (tracked && tracked.length > 0) {
    return Array.from(new Set(tracked)).sort((left, right) => left.localeCompare(right));
  }
  return listDirectories(targetSkillsDir);
}

function pruneOpenClawSkillWorkspace(builtInSkillDirs) {
  mkdirSync(targetSkillsDir, { recursive: true });
  const keep = new Set(builtInSkillDirs);
  const current = listDirectories(targetSkillsDir);
  const removed = [];
  for (const name of current) {
    if (keep.has(name)) {
      continue;
    }
    rmSync(resolve(targetSkillsDir, name), { recursive: true, force: true });
    removed.push(name);
  }
  console.log(
    `[prepare-skill] Kept ${builtInSkillDirs.length} built-in skill${builtInSkillDirs.length === 1 ? "" : "s"} in openclaw/skills`
      + (removed.length > 0 ? `; removed ${removed.length} generated skill dirs` : ""),
  );
}

function writeDefaultEnabledManifest(defaultEnabledSkills) {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    defaultEnabled: Array.from(new Set(defaultEnabledSkills))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
  };
  const raw = `${JSON.stringify(payload, null, 2)}\n`;
  const openclawManifestPath = resolve(targetSkillsDir, DEFAULT_ENABLED_MANIFEST_NAME);
  const bustlyBundleSkillsDir = resolve(electronBustlySkillsTargetDir, "skills");
  const bundledManifestPath = resolve(bustlyBundleSkillsDir, DEFAULT_ENABLED_MANIFEST_NAME);
  mkdirSync(targetSkillsDir, { recursive: true });
  mkdirSync(bustlyBundleSkillsDir, { recursive: true });
  writeFileSync(openclawManifestPath, raw, "utf8");
  writeFileSync(bundledManifestPath, raw, "utf8");
  console.log(
    `[prepare-skill] Wrote bundled default-enabled manifest (${payload.defaultEnabled.length} skills)`,
  );
}

function shouldCopyBustlySkillsBundle(source) {
  const relative = source.slice(bustlySkillsRoot.length).replace(/^[/\\]/, "");
  if (!relative) {
    return true;
  }
  const firstSegment = relative.split(/[/\\]/)[0];
  return ["README.md", "package.json", "bin", "scripts", "skills", "platforms"].includes(firstSegment);
}

function copyBustlySkillsBundle() {
  if (!existsSync(bustlySkillsRoot)) {
    fail(`Missing bustly-skills submodule: ${bustlySkillsRoot}`);
  }

  rmSync(electronBustlySkillsTargetDir, { recursive: true, force: true });
  mkdirSync(electronBustlySkillsTargetDir, { recursive: true });

  cpSync(bustlySkillsRoot, electronBustlySkillsTargetDir, {
    recursive: true,
    dereference: true,
    filter: shouldCopyBustlySkillsBundle,
  });

  console.log(
    `[prepare-skill] Copied bustly-skills bundle to ${electronBustlySkillsTargetDir}`,
  );
}

const options = parseArgs(process.argv.slice(2));
console.log("[prepare-skill] Preparing skills from local bustly-skills checkout");
if (options.skillsBranch) {
  console.log(`[prepare-skill] Using bustly-skills branch: ${options.skillsBranch}`);
}
const builtInSkillDirs = resolveBuiltInSkillDirs();
pruneOpenClawSkillWorkspace(builtInSkillDirs);
copyBustlySkillsBundle();
writeDefaultEnabledManifest(builtInSkillDirs);
