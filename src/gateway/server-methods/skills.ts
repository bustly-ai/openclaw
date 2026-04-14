import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { installSkill } from "../../agents/skills-install.js";
import { buildGlobalSkillStatus, buildWorkspaceSkillStatus } from "../../agents/skills-status.js";
import { loadWorkspaceSkillEntries, type SkillEntry } from "../../agents/skills.js";
import { bumpSkillsSnapshotVersion } from "../../agents/skills/refresh.js";
import { listAgentWorkspaceDirs } from "../../agents/workspace-dirs.js";
import {
  installBustlyGlobalSkill,
  listBustlyGlobalSkillCatalog,
} from "../../bustly/skill-catalog.js";
import type { OpenClawConfig } from "../../config/config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { getRemoteSkillEligibility } from "../../infra/skills-remote.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { normalizeSecretInput } from "../../utils/normalize-secret-input.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateSkillsBinsParams,
  validateSkillsInstallParams,
  validateSkillsStatusParams,
  validateSkillsUpdateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function collectSkillBins(entries: SkillEntry[]): string[] {
  const bins = new Set<string>();
  for (const entry of entries) {
    const required = entry.metadata?.requires?.bins ?? [];
    const anyBins = entry.metadata?.requires?.anyBins ?? [];
    const install = entry.metadata?.install ?? [];
    for (const bin of required) {
      const trimmed = bin.trim();
      if (trimmed) {
        bins.add(trimmed);
      }
    }
    for (const bin of anyBins) {
      const trimmed = bin.trim();
      if (trimmed) {
        bins.add(trimmed);
      }
    }
    for (const spec of install) {
      const specBins = spec?.bins ?? [];
      for (const bin of specBins) {
        const trimmed = String(bin).trim();
        if (trimmed) {
          bins.add(trimmed);
        }
      }
    }
  }
  return [...bins].toSorted();
}

function resolveWorkspaceDirForSkillName(params: {
  config: OpenClawConfig;
  skillName: string;
}): string {
  const normalizedSkillName = params.skillName.trim();
  for (const workspaceDir of listAgentWorkspaceDirs(params.config)) {
    const entries = loadWorkspaceSkillEntries(workspaceDir, { config: params.config });
    if (entries.some((entry) => entry.skill.name === normalizedSkillName)) {
      return workspaceDir;
    }
  }
  return resolveAgentWorkspaceDir(params.config, resolveDefaultAgentId(params.config));
}

export const skillsHandlers: GatewayRequestHandlers = {
  "skills.catalog.list": async ({ respond }) => {
    try {
      const items = await listBustlyGlobalSkillCatalog();
      respond(true, items, undefined);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, error instanceof Error ? error.message : String(error)),
      );
    }
  },
  "skills.catalog.install": async ({ params, respond }) => {
    const skillKey = typeof params.skillKey === "string" ? params.skillKey.trim() : "";
    if (!skillKey) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "skillKey is required"));
      return;
    }
    try {
      await installBustlyGlobalSkill(skillKey);
      respond(true, { ok: true, skillKey }, undefined);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, error instanceof Error ? error.message : String(error)),
      );
    }
  },
  "skills.status": ({ params, respond }) => {
    if (!validateSkillsStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.status params: ${formatValidationErrors(validateSkillsStatusParams.errors)}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentIdRaw = typeof params?.agentId === "string" ? params.agentId.trim() : "";
    const report = agentIdRaw
      ? buildWorkspaceSkillStatus(resolveAgentWorkspaceDir(cfg, normalizeAgentId(agentIdRaw)), {
          config: cfg,
          eligibility: { remote: getRemoteSkillEligibility() },
        })
      : buildGlobalSkillStatus({
          config: cfg,
          eligibility: { remote: getRemoteSkillEligibility() },
        });
    respond(true, report, undefined);
  },
  "skills.bins": ({ params, respond }) => {
    if (!validateSkillsBinsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.bins params: ${formatValidationErrors(validateSkillsBinsParams.errors)}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const workspaceDirs = listAgentWorkspaceDirs(cfg);
    const bins = new Set<string>();
    for (const workspaceDir of workspaceDirs) {
      const entries = loadWorkspaceSkillEntries(workspaceDir, { config: cfg });
      for (const bin of collectSkillBins(entries)) {
        bins.add(bin);
      }
    }
    respond(true, { bins: [...bins].toSorted() }, undefined);
  },
  "skills.install": async ({ params, respond }) => {
    if (!validateSkillsInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.install params: ${formatValidationErrors(validateSkillsInstallParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      name: string;
      installId: string;
      timeoutMs?: number;
    };
    const cfg = loadConfig();
    const workspaceDirRaw = resolveWorkspaceDirForSkillName({
      config: cfg,
      skillName: p.name,
    });
    const result = await installSkill({
      workspaceDir: workspaceDirRaw,
      skillName: p.name,
      installId: p.installId,
      timeoutMs: p.timeoutMs,
      config: cfg,
    });
    if (result.ok) {
      bumpSkillsSnapshotVersion({ workspaceDir: workspaceDirRaw, reason: "manual" });
    }
    respond(
      result.ok,
      result,
      result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.message),
    );
  },
  "skills.update": async ({ params, respond }) => {
    if (!validateSkillsUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.update params: ${formatValidationErrors(validateSkillsUpdateParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      skillKey: string;
      apiKey?: string;
      env?: Record<string, string>;
    };
    const cfg = loadConfig();
    const skills = cfg.skills ? { ...cfg.skills } : {};
    const entries = skills.entries ? { ...skills.entries } : {};
    const current = entries[p.skillKey] ? { ...entries[p.skillKey] } : {};
    if (typeof p.apiKey === "string") {
      const trimmed = normalizeSecretInput(p.apiKey);
      if (trimmed) {
        current.apiKey = trimmed;
      } else {
        delete current.apiKey;
      }
    }
    if (p.env && typeof p.env === "object") {
      const nextEnv = current.env ? { ...current.env } : {};
      for (const [key, value] of Object.entries(p.env)) {
        const trimmedKey = key.trim();
        if (!trimmedKey) {
          continue;
        }
        const trimmedVal = value.trim();
        if (!trimmedVal) {
          delete nextEnv[trimmedKey];
        } else {
          nextEnv[trimmedKey] = trimmedVal;
        }
      }
      current.env = nextEnv;
    }
    delete current.enabled;
    if (current.env && Object.keys(current.env).length === 0) {
      delete current.env;
    }
    if (Object.keys(current).length === 0) {
      delete entries[p.skillKey];
    } else {
      entries[p.skillKey] = current;
    }
    skills.entries = entries;
    const nextConfig: OpenClawConfig = {
      ...cfg,
      skills,
    };
    await writeConfigFile(nextConfig);
    bumpSkillsSnapshotVersion({ reason: "manual" });
    respond(true, { ok: true, skillKey: p.skillKey, config: current }, undefined);
  },
};
