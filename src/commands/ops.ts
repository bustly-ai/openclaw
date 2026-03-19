import fs from "node:fs";
import path from "node:path";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  hasBinary,
  loadWorkspaceSkillEntries,
  matchesOpsSkillLookup,
  resolveSkillRuntime,
  type SkillEntry,
} from "../agents/skills.js";
import { installSkill } from "../agents/skills-install.js";
import { loadConfig, type OpenClawConfig } from "../config/config.js";
import { runCommandWithTimeout } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { invalidateHasBinaryCache } from "../shared/config-eval.js";

type ResolvedOpsSkill = {
  workspaceDir: string;
  entry: SkillEntry;
};

function resolveCandidateWorkspaces(config: OpenClawConfig): string[] {
  const candidates = [process.cwd()];
  const defaultWorkspace = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  if (defaultWorkspace && !candidates.includes(defaultWorkspace)) {
    candidates.push(defaultWorkspace);
  }
  return candidates;
}

function findOpsSkillInWorkspace(
  workspaceDir: string,
  rawSkill: string,
  config: OpenClawConfig,
): ResolvedOpsSkill | undefined {
  if (!fs.existsSync(path.join(workspaceDir, "skills"))) {
    return undefined;
  }

  const entries = loadWorkspaceSkillEntries(workspaceDir, { config });
  const entry = entries.find((candidate) => {
    if (candidate.metadata?.commandHints?.commandNamespace !== "bustly ops") {
      return false;
    }
    return matchesOpsSkillLookup(candidate, rawSkill);
  });
  if (!entry) {
    return undefined;
  }
  return { workspaceDir, entry };
}

function resolveOpsSkill(config: OpenClawConfig, rawSkill: string): ResolvedOpsSkill | undefined {
  for (const workspaceDir of resolveCandidateWorkspaces(config)) {
    const match = findOpsSkillInWorkspace(workspaceDir, rawSkill, config);
    if (match) {
      return match;
    }
  }
  return undefined;
}

async function ensureRuntimeExecutable(params: {
  resolved: ResolvedOpsSkill;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
}): Promise<string | null> {
  const runtimeMeta = resolveSkillRuntime(params.resolved.entry);
  const executable = runtimeMeta?.executable?.trim();
  if (!executable) {
    params.runtime.error(`Skill "${params.resolved.entry.skill.name}" is missing runtime metadata.`);
    return null;
  }

  if (hasBinary(executable)) {
    return executable;
  }

  const installSpec = runtimeMeta?.installSpec?.trim();
  if (!installSpec) {
    params.runtime.error(
      `Runtime executable "${executable}" is not installed and no runtimeInstallSpec was declared.`,
    );
    return null;
  }

  params.runtime.log(
    `Installing ${params.resolved.entry.skill.name} runtime (${installSpec}) because "${executable}" is missing...`,
  );
  const result = await installSkill({
    workspaceDir: params.resolved.workspaceDir,
    skillName: params.resolved.entry.skill.name,
    installId: "runtime",
    config: params.config,
  });
  for (const warning of result.warnings ?? []) {
    params.runtime.error(warning);
  }
  if (!result.ok) {
    params.runtime.error(result.message);
    if (result.stderr) {
      params.runtime.error(result.stderr);
    }
    return null;
  }

  invalidateHasBinaryCache();
  if (!hasBinary(executable)) {
    params.runtime.error(
      `Installed ${params.resolved.entry.skill.name} runtime, but executable "${executable}" is still not on PATH.`,
    );
    return null;
  }

  return executable;
}

export async function opsCommand(
  params: {
    skill: string;
    args: string[];
    config?: OpenClawConfig;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  const config = params.config ?? loadConfig();
  const resolved = resolveOpsSkill(config, params.skill);
  if (!resolved) {
    runtime.error(`Unknown ops skill: ${params.skill}`);
    runtime.exit(1);
    return;
  }

  const executable = await ensureRuntimeExecutable({ resolved, config, runtime });
  if (!executable) {
    runtime.exit(1);
    return;
  }

  let commandResult: Awaited<ReturnType<typeof runCommandWithTimeout>>;
  try {
    commandResult = await runCommandWithTimeout([executable, ...params.args], {
      timeoutMs: 900_000,
    });
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : String(error));
    runtime.exit(1);
    return;
  }
  const stdout = commandResult.stdout.trimEnd();
  const stderr = commandResult.stderr.trimEnd();
  if (stdout) {
    runtime.log(stdout);
  }
  if (stderr) {
    runtime.error(stderr);
  }
  if (commandResult.code !== 0) {
    runtime.exit(commandResult.code ?? 1);
  }
}
