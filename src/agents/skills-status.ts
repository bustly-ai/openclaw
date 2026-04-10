import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import type { RequirementConfigCheck, Requirements } from "../shared/requirements.js";
import { evaluateEntryRequirementsForCurrentPlatform } from "../shared/entry-status.js";
import { CONFIG_DIR } from "../utils.js";
import { listAgentWorkspaceDirs } from "./workspace-dirs.js";
import {
  hasBinary,
  isConfigPathTruthy,
  loadWorkspaceSkillEntries,
  resolveSkillInstallSpecs,
  resolveSkillConfig,
  resolveSkillsInstallPreferences,
  type SkillCommandRuntimeSpec,
  type SkillEntry,
  type SkillEligibilityContext,
  type SkillInstallSpec,
  type SkillsInstallPreferences,
} from "./skills.js";
import { resolveBundledSkillsContext } from "./skills/bundled-context.js";

export type SkillStatusConfigCheck = RequirementConfigCheck;

export type SkillInstallOption = {
  id: string;
  kind: SkillInstallSpec["kind"];
  label: string;
  bins: string[];
};

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: Requirements;
  missing: Requirements;
  configChecks: SkillStatusConfigCheck[];
  install: SkillInstallOption[];
  runtime?: SkillCommandRuntimeSpec;
  resolvedCommand?: string;
};

export type SkillStatusReport = {
  scope?: "agent" | "global";
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};

function resolveSkillKey(entry: SkillEntry): string {
  return entry.metadata?.skillKey ?? entry.skill.name;
}

function selectPreferredInstallSpec(
  install: SkillInstallSpec[],
  prefs: SkillsInstallPreferences,
): { spec: SkillInstallSpec; index: number } | undefined {
  if (install.length === 0) {
    return undefined;
  }

  const indexed = install.map((spec, index) => ({ spec, index }));
  const findKind = (kind: SkillInstallSpec["kind"]) =>
    indexed.find((item) => item.spec.kind === kind);

  const brewSpec = findKind("brew");
  const nodeSpec = findKind("node");
  const goSpec = findKind("go");
  const uvSpec = findKind("uv");
  const downloadSpec = findKind("download");
  const brewAvailable = hasBinary("brew");

  // Table-driven preference chain; first match wins.
  const pickers: Array<() => { spec: SkillInstallSpec; index: number } | undefined> = [
    () => (prefs.preferBrew && brewAvailable ? brewSpec : undefined),
    () => uvSpec,
    () => nodeSpec,
    // Only prefer brew when available to avoid guaranteed failure on Linux/Docker.
    () => (brewAvailable ? brewSpec : undefined),
    () => goSpec,
    // Prefer download over an unavailable brew spec.
    () => downloadSpec,
    // Last resort: surface descriptive brew-missing error instead of "no installer found".
    () => brewSpec,
    () => indexed[0],
  ];

  for (const pick of pickers) {
    const selected = pick();
    if (selected) {
      return selected;
    }
  }

  return undefined;
}

function normalizeInstallOptions(
  entry: SkillEntry,
  prefs: SkillsInstallPreferences,
): SkillInstallOption[] {
  // If the skill is explicitly OS-scoped, don't surface install actions on unsupported platforms.
  // (Installers run locally; remote OS eligibility is handled separately.)
  const requiredOs = entry.metadata?.os ?? [];
  if (requiredOs.length > 0 && !requiredOs.includes(process.platform)) {
    return [];
  }

  const install = resolveSkillInstallSpecs(entry);
  if (install.length === 0) {
    return [];
  }

  const platform = process.platform;
  const filtered = install.filter((spec) => {
    const osList = spec.os ?? [];
    return osList.length === 0 || osList.includes(platform);
  });
  if (filtered.length === 0) {
    return [];
  }

  const toOption = (spec: SkillInstallSpec, index: number): SkillInstallOption => {
    const id = (spec.id ?? `${spec.kind}-${index}`).trim();
    const bins = spec.bins ?? [];
    let label = (spec.label ?? "").trim();
    if (spec.kind === "node" && spec.package) {
      label = `Install ${spec.package} (${prefs.nodeManager})`;
    }
    if (!label) {
      if (spec.kind === "brew" && spec.formula) {
        label = `Install ${spec.formula} (brew)`;
      } else if (spec.kind === "node" && spec.package) {
        label = `Install ${spec.package} (${prefs.nodeManager})`;
      } else if (spec.kind === "go" && spec.module) {
        label = `Install ${spec.module} (go)`;
      } else if (spec.kind === "uv" && spec.package) {
        label = `Install ${spec.package} (uv)`;
      } else if (spec.kind === "download" && spec.url) {
        const url = spec.url.trim();
        const last = url.split("/").pop();
        label = `Download ${last && last.length > 0 ? last : url}`;
      } else {
        label = "Run installer";
      }
    }
    return { id, kind: spec.kind, label, bins };
  };

  const allDownloads = filtered.every((spec) => spec.kind === "download");
  if (allDownloads) {
    return filtered.map((spec, index) => toOption(spec, index));
  }

  const preferred = selectPreferredInstallSpec(filtered, prefs);
  if (!preferred) {
    return [];
  }
  return [toOption(preferred.spec, preferred.index)];
}

function resolvePreferredCommand(entry: SkillEntry): string | undefined {
  const hints = entry.metadata?.commandHints;
  if (hints?.defaultCommand) {
    return hints.defaultCommand;
  }
  if (hints?.discoveryCommand) {
    return hints.discoveryCommand;
  }
  const runtimeExecutable = hints?.runtime?.executable?.trim();
  if (runtimeExecutable && hasBinary(runtimeExecutable)) {
    return runtimeExecutable;
  }
  if (hints?.fallbackCommand) {
    return hints.fallbackCommand;
  }
  return undefined;
}
function buildSkillStatus(
  entry: SkillEntry,
  config?: OpenClawConfig,
  prefs?: SkillsInstallPreferences,
  eligibility?: SkillEligibilityContext,
  bundledNames?: Set<string>,
): SkillStatusEntry {
  const skillKey = resolveSkillKey(entry);
  const skillConfig = resolveSkillConfig(config, skillKey);
  const disabled = false;
  const blockedByAllowlist = false;
  const always = entry.metadata?.always === true;
  const isEnvSatisfied = (envName: string) =>
    Boolean(
      process.env[envName] ||
      skillConfig?.env?.[envName] ||
      (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName),
    );
  const isConfigSatisfied = (pathStr: string) => isConfigPathTruthy(config, pathStr);
  const bundled =
    bundledNames && bundledNames.size > 0
      ? bundledNames.has(entry.skill.name)
      : entry.skill.source === "openclaw-bundled";

  const { emoji, homepage, required, missing, requirementsSatisfied, configChecks } =
    evaluateEntryRequirementsForCurrentPlatform({
      always,
      entry,
      hasLocalBin: hasBinary,
      remote: eligibility?.remote,
      isEnvSatisfied,
      isConfigSatisfied,
    });
  const eligible = requirementsSatisfied;

  return {
    name: entry.skill.name,
    description: entry.skill.description,
    source: entry.skill.source,
    bundled,
    filePath: entry.skill.filePath,
    baseDir: entry.skill.baseDir,
    skillKey,
    primaryEnv: entry.metadata?.primaryEnv,
    emoji,
    homepage,
    always,
    disabled,
    blockedByAllowlist,
    eligible,
    requirements: required,
    missing,
    configChecks,
    install: normalizeInstallOptions(entry, prefs ?? resolveSkillsInstallPreferences(config)),
    runtime: entry.metadata?.commandHints?.runtime,
    resolvedCommand: resolvePreferredCommand(entry),
  };
}

export function buildWorkspaceSkillStatus(
  workspaceDir: string,
  opts?: {
    config?: OpenClawConfig;
    managedSkillsDir?: string;
    entries?: SkillEntry[];
    eligibility?: SkillEligibilityContext;
  },
): SkillStatusReport {
  const managedSkillsDir = opts?.managedSkillsDir ?? path.join(CONFIG_DIR, "skills");
  const bundledContext = resolveBundledSkillsContext();
  const skillEntries =
    opts?.entries ??
    loadWorkspaceSkillEntries(workspaceDir, {
      config: opts?.config,
      managedSkillsDir,
      bundledSkillsDir: bundledContext.dir,
    });
  const prefs = resolveSkillsInstallPreferences(opts?.config);
  return {
    scope: "agent",
    workspaceDir,
    managedSkillsDir,
    skills: skillEntries.map((entry) =>
      buildSkillStatus(entry, opts?.config, prefs, opts?.eligibility, bundledContext.names),
    ),
  };
}

const GLOBAL_SKILL_SOURCE_PRIORITY: Record<string, number> = {
  "openclaw-extra": 0,
  "openclaw-bundled": 1,
  "openclaw-managed": 2,
  "agents-skills-personal": 3,
  "agents-skills-project": 4,
  "openclaw-workspace": 5,
};

function resolveGlobalSkillSourcePriority(entry: SkillEntry): number {
  return GLOBAL_SKILL_SOURCE_PRIORITY[entry.skill.source] ?? 0;
}

function mergeGlobalSkillEntries(entrySets: SkillEntry[][]): SkillEntry[] {
  const merged = new Map<string, { entry: SkillEntry; priority: number }>();
  for (const entries of entrySets) {
    for (const entry of entries) {
      const key = entry.skill.name;
      const priority = resolveGlobalSkillSourcePriority(entry);
      const current = merged.get(key);
      if (!current || priority > current.priority) {
        merged.set(key, { entry, priority });
      }
    }
  }
  return [...merged.values()]
    .map((item) => item.entry)
    .sort((left, right) => left.skill.name.localeCompare(right.skill.name));
}

export function buildGlobalSkillStatus(opts?: {
  config?: OpenClawConfig;
  managedSkillsDir?: string;
  eligibility?: SkillEligibilityContext;
}): SkillStatusReport {
  const config = opts?.config ?? {};
  const managedSkillsDir = opts?.managedSkillsDir ?? path.join(CONFIG_DIR, "skills");
  const bundledContext = resolveBundledSkillsContext();
  const workspaceDirs = listAgentWorkspaceDirs(config);
  const entrySets = workspaceDirs.map((workspaceDir) =>
    loadWorkspaceSkillEntries(workspaceDir, {
      config,
      managedSkillsDir,
      bundledSkillsDir: bundledContext.dir,
    }),
  );
  const skillEntries = mergeGlobalSkillEntries(entrySets);
  const prefs = resolveSkillsInstallPreferences(config);
  return {
    scope: "global",
    workspaceDir: managedSkillsDir,
    managedSkillsDir,
    skills: skillEntries.map((entry) =>
      buildSkillStatus(entry, config, prefs, opts?.eligibility, bundledContext.names),
    ),
  };
}
