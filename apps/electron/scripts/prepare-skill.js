import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const bustlySkillsRoot = resolve(repoRoot, "bustly-skills");
const sourceSkillsDir = resolve(bustlySkillsRoot, "skills");
const targetSkillsDir = resolve(repoRoot, "skills");

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
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    if (stderr) {
      console.error(stderr);
    } else if (stdout) {
      console.error(stdout);
    }
    process.exit(result.status ?? 1);
  }
  return result.stdout?.trim() || "";
}

function parseArgs(argv) {
  let branch = "main";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm run prepare-skill -- [branch]");
      console.log("   or: pnpm run prepare-skill -- --branch <branch>");
      process.exit(0);
    }
    if (arg === "--branch" || arg === "-b") {
      const next = argv[index + 1]?.trim();
      if (!next) {
        fail(`Missing value for ${arg}`);
      }
      branch = next;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    }
    branch = arg.trim() || branch;
  }
  if (!branch) {
    fail("Branch name cannot be empty.");
  }
  return branch;
}

function ensureCleanSubmodule() {
  const status = runCapture("git", ["status", "--porcelain"], bustlySkillsRoot);
  if (status) {
    fail("bustly-skills has uncommitted changes. Clean the submodule before running prepare-skill.");
  }
}

function ensureBranch(branch) {
  run("git", ["submodule", "update", "--init", "bustly-skills"], repoRoot);
  ensureCleanSubmodule();
  run("git", ["fetch", "origin", branch], bustlySkillsRoot);

  const hasLocalBranch = spawnSync("git", ["rev-parse", "--verify", `refs/heads/${branch}`], {
    cwd: bustlySkillsRoot,
    stdio: "ignore",
  }).status === 0;

  if (hasLocalBranch) {
    run("git", ["checkout", branch], bustlySkillsRoot);
    run("git", ["pull", "--ff-only", "origin", branch], bustlySkillsRoot);
    return;
  }

  run("git", ["checkout", "-b", branch, "--track", `origin/${branch}`], bustlySkillsRoot);
}

function copySkills() {
  if (!existsSync(sourceSkillsDir)) {
    fail(`Missing source skills directory: ${sourceSkillsDir}`);
  }

  mkdirSync(targetSkillsDir, { recursive: true });
  const copied = readdirSync(sourceSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (copied.length === 0) {
    fail(`No skill directories found in ${sourceSkillsDir}`);
  }

  for (const name of copied) {
    const sourcePath = resolve(sourceSkillsDir, name);
    const targetPath = resolve(targetSkillsDir, name);
    rmSync(targetPath, { recursive: true, force: true });
    cpSync(sourcePath, targetPath, { recursive: true, dereference: true });
  }

  console.log(
    `[prepare-skill] Copied ${copied.length} skill${copied.length === 1 ? "" : "s"}: ${copied.join(", ")}`,
  );
}

const branch = parseArgs(process.argv.slice(2));
console.log(`[prepare-skill] Preparing skills from bustly-skills (${branch})`);
ensureBranch(branch);
copySkills();
