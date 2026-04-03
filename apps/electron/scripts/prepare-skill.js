import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const bustlySkillsRoot = resolve(repoRoot, "bustly-skills");
const sourceSkillsDir = resolve(bustlySkillsRoot, "skills");
const targetSkillsDir = resolve(repoRoot, "skills");
const electronBustlySkillsTargetDir = resolve(repoRoot, "apps", "electron", "resources", "bustly-skills");

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

function parseArgs(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm run prepare-skill");
      process.exit(0);
    }
    if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    }
    fail(`Unexpected argument: ${arg}`);
  }

  if (existsSync(sourceSkillsDir)) {
    console.log(
      "[prepare-skill] Using existing local bustly-skills checkout without resetting its branch or commit",
    );
    return;
  }

  console.log("[prepare-skill] Initializing bustly-skills submodule");
  run("git", ["submodule", "update", "--init", "bustly-skills"], repoRoot);
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

parseArgs(process.argv.slice(2));
console.log("[prepare-skill] Preparing skills from local bustly-skills checkout");
copySkills();
copyBustlySkillsBundle();
