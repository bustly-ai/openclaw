import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeSkillFilterForComparison } from "./skills/filter.js";

export type BustlyAgentUseCase = {
  label: string;
  prompt: string;
};

export type BustlyAgentMetadata = {
  label?: string;
  icon?: string;
  createdAt?: number;
  skills?: string[];
  useCases?: BustlyAgentUseCase[];
};

export function resolveBustlyAgentMetadataPath(agentWorkspaceDir: string): string {
  return path.join(agentWorkspaceDir, ".bustly-agent.json");
}

export function normalizeBustlyAgentMetadata(raw: unknown): BustlyAgentMetadata {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const parsed = raw as {
    label?: unknown;
    icon?: unknown;
    createdAt?: unknown;
    skills?: unknown;
    useCases?: unknown;
  };
  const label = typeof parsed.label === "string" ? parsed.label.trim() || undefined : undefined;
  const icon = typeof parsed.icon === "string" ? parsed.icon.trim() || undefined : undefined;
  const createdAt =
    typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
      ? parsed.createdAt
      : undefined;
  const skills = Array.isArray(parsed.skills)
    ? normalizeSkillFilterForComparison(parsed.skills)
    : undefined;
  const useCases = Array.isArray(parsed.useCases)
    ? parsed.useCases.flatMap((rawUseCase) => {
        if (!rawUseCase || typeof rawUseCase !== "object") {
          return [];
        }
        const useCase = rawUseCase as Record<string, unknown>;
        const useCaseLabel = typeof useCase.label === "string" ? useCase.label.trim() : "";
        const prompt = typeof useCase.prompt === "string" ? useCase.prompt.trim() : "";
        if (!useCaseLabel || !prompt) {
          return [];
        }
        return [{ label: useCaseLabel, prompt }];
      })
    : undefined;
  return {
    ...(label ? { label } : {}),
    ...(icon ? { icon } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(skills !== undefined ? { skills } : {}),
    ...(useCases !== undefined ? { useCases } : {}),
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
