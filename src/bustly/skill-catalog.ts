import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildGlobalSkillStatus } from "../agents/skills-status.js";
import { bumpSkillsSnapshotVersion } from "../agents/skills/refresh.js";
import { loadConfig } from "../config/config.js";
import { getRemoteSkillEligibility } from "../infra/skills-remote.js";
import { CONFIG_DIR } from "../utils.js";
import { bustlySupabaseFetch } from "./supabase.js";

export type BustlyGlobalSkillCatalogItem = {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceLabel: string;
  skillKey: string;
  filePath: string;
  homepage?: string;
  primaryEnv?: string;
  eligible: boolean;
  bundled: boolean;
  category: string;
  installed: boolean;
  canInstall: boolean;
};

type BustlyGlobalSkillCatalogRow = {
  slug: string | null;
  name: string | null;
  description: string | null;
  sub_layer: string | null;
  published_version_id: string | null;
};

type BustlyPublishedSkillFileRow = {
  relative_path: string | null;
  file_content: string | null;
};

const BUSTLY_SKILL_SOURCE_LABELS: Record<string, string> = {
  "openclaw-bundled": "Built-in",
  "openclaw-managed": "Managed",
  "openclaw-workspace": "Workspace",
  "openclaw-extra": "Shared",
  "agents-skills-personal": "Workspace",
  "agents-skills-project": "Workspace",
  "skillops-catalog": "Catalog",
};

const BUSTLY_UPPERCASE_CATEGORY_TOKENS = new Set([
  "ai",
  "crm",
  "dtc",
  "erp",
  "hr",
  "mcp",
  "qa",
  "roi",
  "seo",
  "ugc",
  "ux",
]);

function resolveBustlyManagedSkillsDir(): string {
  return join(CONFIG_DIR, "skills");
}

function normalizeBustlySkillLookupToken(value: string | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") ?? "";
}

function toBustlyCategoryWord(part: string): string {
  if (!part) {
    return "";
  }
  if (BUSTLY_UPPERCASE_CATEGORY_TOKENS.has(part)) {
    return part.toUpperCase();
  }
  return `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
}

function formatBustlySkillCategoryLabel(value: string | undefined): string {
  const normalized = normalizeBustlySkillLookupToken(value);
  if (!normalized) {
    return "Uncategorized";
  }
  return normalized
    .split("-")
    .map((part) => toBustlyCategoryWord(part))
    .join(" ");
}

function resolveBustlySkillSourceLabel(source: string): string {
  return BUSTLY_SKILL_SOURCE_LABELS[source] ?? source.replace(/^openclaw-/, "").replace(/^agents-skills-/, "");
}

async function fetchBustlyGlobalSkillCatalogRows(): Promise<BustlyGlobalSkillCatalogRow[]> {
  const query = new URLSearchParams({
    select: "slug,name,description,sub_layer,published_version_id",
    status: "eq.enabled",
    order: "name.asc",
  });
  const response = await bustlySupabaseFetch({
    path: `/rest/v1/skills?${query.toString()}`,
    headers: {
      "Accept-Profile": "skillops",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load skill catalog (status ${response.status}).`);
  }
  return (await response.json()) as BustlyGlobalSkillCatalogRow[];
}

function resolveBustlySkillFileTargetPath(rootDir: string, relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").trim().replace(/^\/+/, "");
  if (!normalized) {
    throw new Error("Invalid skill file path.");
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid skill file path: ${relativePath}`);
  }
  return join(rootDir, ...parts);
}

export async function listBustlyGlobalSkillCatalog(): Promise<BustlyGlobalSkillCatalogItem[]> {
  const [rows, cfg] = await Promise.all([fetchBustlyGlobalSkillCatalogRows(), Promise.resolve(loadConfig())]);
  const globalStatus = buildGlobalSkillStatus({
    config: cfg,
    managedSkillsDir: resolveBustlyManagedSkillsDir(),
    eligibility: { remote: getRemoteSkillEligibility() },
  });
  const statusByKey = new Map<string, (typeof globalStatus.skills)[number]>();
  const statusByName = new Map<string, (typeof globalStatus.skills)[number]>();
  for (const skill of globalStatus.skills) {
    const skillKeyToken = normalizeBustlySkillLookupToken(skill.skillKey);
    const skillNameToken = normalizeBustlySkillLookupToken(skill.name);
    if (skillKeyToken) {
      statusByKey.set(skillKeyToken, skill);
    }
    if (skillNameToken) {
      statusByName.set(skillNameToken, skill);
    }
  }
  return rows.map((row, index) => {
    const slug = row.slug?.trim() || row.name?.trim() || `skill-${index + 1}`;
    const slugToken = normalizeBustlySkillLookupToken(row.slug ?? undefined);
    const nameToken = normalizeBustlySkillLookupToken(row.name ?? undefined);
    const installedSkill = (
      (slugToken ? statusByKey.get(slugToken) : undefined)
      || (nameToken ? statusByKey.get(nameToken) : undefined)
      || (nameToken ? statusByName.get(nameToken) : undefined)
    );
    return {
      id: slug,
      name: row.name?.trim() || slug,
      description: row.description?.trim() || "",
      source: installedSkill?.source?.trim() || "skillops-catalog",
      sourceLabel: resolveBustlySkillSourceLabel(installedSkill?.source?.trim() || "skillops-catalog"),
      skillKey: slug,
      filePath: installedSkill?.filePath?.trim() || "",
      homepage: installedSkill?.homepage?.trim() || undefined,
      primaryEnv: installedSkill?.primaryEnv?.trim() || undefined,
      eligible: installedSkill?.eligible === true,
      bundled: installedSkill?.bundled === true || installedSkill?.source === "openclaw-bundled",
      category: formatBustlySkillCategoryLabel(row.sub_layer ?? undefined),
      installed: Boolean(installedSkill),
      canInstall: !installedSkill && Boolean(row.published_version_id?.trim()),
    };
  });
}

export async function installBustlyGlobalSkill(skillKey: string): Promise<void> {
  const normalizedSkillKey = skillKey.trim();
  if (!normalizedSkillKey) {
    throw new Error("Skill key is required.");
  }
  const skillQuery = new URLSearchParams({
    select: "slug,published_version_id",
    status: "eq.enabled",
    slug: `eq.${normalizedSkillKey}`,
    limit: "1",
  });
  const skillResponse = await bustlySupabaseFetch({
    path: `/rest/v1/skills?${skillQuery.toString()}`,
    headers: {
      "Accept-Profile": "skillops",
    },
  });
  if (!skillResponse.ok) {
    throw new Error(`Failed to resolve skill "${normalizedSkillKey}" (status ${skillResponse.status}).`);
  }
  const [skillRow] = (await skillResponse.json()) as Array<{
    slug: string | null;
    published_version_id: string | null;
  }>;
  const publishedVersionId = skillRow?.published_version_id?.trim();
  const slug = skillRow?.slug?.trim() || normalizedSkillKey;
  if (!publishedVersionId) {
    throw new Error(`Skill "${slug}" does not have a published version yet.`);
  }
  const filesQuery = new URLSearchParams({
    select: "relative_path,file_content",
    skill_version_id: `eq.${publishedVersionId}`,
    order: "relative_path.asc",
  });
  const filesResponse = await bustlySupabaseFetch({
    path: `/rest/v1/skill_version_files?${filesQuery.toString()}`,
    headers: {
      "Accept-Profile": "skillops",
    },
  });
  if (!filesResponse.ok) {
    throw new Error(`Failed to download skill "${slug}" files (status ${filesResponse.status}).`);
  }
  const files = (await filesResponse.json()) as BustlyPublishedSkillFileRow[];
  if (files.length === 0) {
    throw new Error(`Skill "${slug}" does not contain any published files.`);
  }
  const targetRoot = join(resolveBustlyManagedSkillsDir(), slug);
  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });
  let hasSkillMd = false;
  for (const file of files) {
    const relativePath = file.relative_path?.trim();
    if (!relativePath) {
      continue;
    }
    const targetPath = resolveBustlySkillFileTargetPath(targetRoot, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.file_content ?? "", "utf-8");
    if (relativePath.replaceAll("\\", "/") === "SKILL.md") {
      hasSkillMd = true;
    }
  }
  if (!hasSkillMd) {
    rmSync(targetRoot, { recursive: true, force: true });
    throw new Error(`Skill "${slug}" is missing SKILL.md.`);
  }
  bumpSkillsSnapshotVersion({ reason: "manual" });
}
