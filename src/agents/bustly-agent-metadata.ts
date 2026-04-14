import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeSkillFilterForComparison } from "./skills/filter.js";

export type BustlyAgentMetadata = {
  icon?: string;
  createdAt?: number;
  skills?: string[];
};

export function resolveBustlyAgentMetadataPath(agentWorkspaceDir: string): string {
  return path.join(agentWorkspaceDir, ".bustly-agent.json");
}

function normalizeBustlyAgentMetadata(raw: unknown): BustlyAgentMetadata {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const parsed = raw as {
    icon?: unknown;
    createdAt?: unknown;
    skills?: unknown;
  };
  const icon = typeof parsed.icon === "string" ? parsed.icon.trim() || undefined : undefined;
  const createdAt =
    typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
      ? parsed.createdAt
      : undefined;
  const skills = Array.isArray(parsed.skills)
    ? normalizeSkillFilterForComparison(parsed.skills)
    : undefined;
  return {
    ...(icon ? { icon } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(skills !== undefined ? { skills } : {}),
  };
}

export function loadBustlyAgentMetadata(agentWorkspaceDir: string): BustlyAgentMetadata {
  const metadataPath = resolveBustlyAgentMetadataPath(agentWorkspaceDir);
  if (!existsSync(metadataPath)) {
    return {};
  }
  try {
    return normalizeBustlyAgentMetadata(JSON.parse(readFileSync(metadataPath, "utf-8")));
  } catch {
    return {};
  }
}

export function saveBustlyAgentMetadata(
  agentWorkspaceDir: string,
  metadata: BustlyAgentMetadata,
): BustlyAgentMetadata {
  const normalized = normalizeBustlyAgentMetadata(metadata);
  mkdirSync(agentWorkspaceDir, { recursive: true });
  writeFileSync(
    resolveBustlyAgentMetadataPath(agentWorkspaceDir),
    JSON.stringify(normalized, null, 2),
    "utf-8",
  );
  return normalized;
}
