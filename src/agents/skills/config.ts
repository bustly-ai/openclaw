import type { OpenClawConfig, SkillConfig } from "../../config/config.js";
import type { SkillEligibilityContext, SkillEntry } from "./types.js";
import {
  evaluateRuntimeEligibility,
  hasBinary,
  isConfigPathTruthyWithDefaults,
  resolveConfigPath,
  resolveRuntimePlatform,
} from "../../shared/config-eval.js";
import { resolveSkillKey } from "./frontmatter.js";

const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
};

export { hasBinary, resolveConfigPath, resolveRuntimePlatform };

function normalizeSkillToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactSkillToken(value: string): string {
  return normalizeSkillToken(value).replace(/-/g, "");
}

export function isConfigPathTruthy(config: OpenClawConfig | undefined, pathStr: string): boolean {
  return isConfigPathTruthyWithDefaults(config, pathStr, DEFAULT_CONFIG_VALUES);
}

export function resolveSkillConfig(
  config: OpenClawConfig | undefined,
  skillKey: string,
): SkillConfig | undefined {
  const skills = config?.skills?.entries;
  if (!skills || typeof skills !== "object") {
    return undefined;
  }
  const typedSkills = skills as Record<string, SkillConfig | undefined>;
  const entry = typedSkills[skillKey];
  if (!entry || typeof entry !== "object") {
    const normalizedSkillKey = normalizeSkillToken(skillKey);
    if (!normalizedSkillKey) {
      return undefined;
    }
    const compactTarget = compactSkillToken(skillKey);
    for (const [configuredKey, configuredValue] of Object.entries(typedSkills)) {
      if (!configuredValue || typeof configuredValue !== "object") {
        continue;
      }
      if (
        normalizeSkillToken(configuredKey) === normalizedSkillKey ||
        compactSkillToken(configuredKey) === compactTarget
      ) {
        return configuredValue;
      }
    }
    return undefined;
  }
  return entry;
}

export function shouldIncludeSkill(params: {
  entry: SkillEntry;
  config?: OpenClawConfig;
  eligibility?: SkillEligibilityContext;
}): boolean {
  const { entry, config, eligibility } = params;
  const skillKey = resolveSkillKey(entry.skill, entry);
  const skillConfig = resolveSkillConfig(config, skillKey);
  return evaluateRuntimeEligibility({
    os: entry.metadata?.os,
    remotePlatforms: eligibility?.remote?.platforms,
    always: entry.metadata?.always,
    requires: entry.metadata?.requires,
    hasBin: hasBinary,
    hasRemoteBin: eligibility?.remote?.hasBin,
    hasAnyRemoteBin: eligibility?.remote?.hasAnyBin,
    hasEnv: (envName) =>
      Boolean(
        process.env[envName] ||
        skillConfig?.env?.[envName] ||
        (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName),
      ),
    isConfigPathTruthy: (configPath) => isConfigPathTruthy(config, configPath),
  });
}
