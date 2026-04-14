import {
  installGlobalSkillCatalogItem as installGlobalSkillCatalogItemViaGateway,
  listGlobalSkillCatalog,
  requestBustlyGatewayMethod,
} from "./bustly-gateway";
import { runSupabaseRequestWithRetry } from "./bustly-supabase";

export type GatewaySkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  skillKey: string;
  filePath: string;
  homepage?: string;
  primaryEnv?: string;
  eligible: boolean;
  bundled?: boolean;
  install?: GatewaySkillInstallOption[];
};

export type GatewaySkillInstallOption = {
  id: string;
  kind: string;
  label: string;
  bins: string[];
};

export type GatewaySkillStatusReport = {
  scope?: "agent" | "global";
  workspaceDir: string;
  managedSkillsDir: string;
  skills: GatewaySkillStatusEntry[];
};

export type SkillCategory = string;

export type SkillCatalogItem = {
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
  category: SkillCategory;
  installOptions: GatewaySkillInstallOption[];
  installed: boolean;
  canInstall: boolean;
};

type SupabaseSkillCategoryRow = {
  slug: string | null;
  name: string | null;
  sub_layer: string | null;
};

type SkillCategoryLookup = {
  bySlug: Map<string, SkillCategory>;
  byName: Map<string, SkillCategory>;
};

const SOURCE_LABELS: Record<string, string> = {
  "openclaw-bundled": "Built-in",
  "openclaw-managed": "Managed",
  "openclaw-workspace": "Workspace",
  "openclaw-extra": "Shared",
  "agents-skills-personal": "Workspace",
  "agents-skills-project": "Workspace",
};

const UNCATEGORIZED_CATEGORY_LABEL = "Uncategorized";
const UPPERCASE_CATEGORY_TOKENS = new Set([
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
const SKILL_CATEGORY_CACHE_TTL_MS = 60_000;
const CURATED_RECOMMENDED_SKILL_NAMES = [
  "ads-core-ops",
  "clawhub",
  "coding-agent",
  "commerce-core-ops",
  "gog",
  "hubspot",
  "meta-ads",
  "docx-generator",
  "pdf-generator",
  "tts-generator",
  "xlsx-generator",
  "image-generator",
  "video-generator",
  "pptx-generator",
  "shipstation",
  "skill-creator",
  "slack",
  "aliexpress-source-product",
  "zendesk",
] as const;

let cachedSkillCategoryLookup: SkillCategoryLookup | null = null;
let cachedSkillCategoryLookupExpiresAt = 0;
let pendingSkillCategoryLookup: Promise<SkillCategoryLookup> | null = null;

function resolveSkillSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/^openclaw-/, "").replace(/^agents-skills-/, "");
}

function compareSkillNames(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function compareSkillCategories(left: SkillCategory, right: SkillCategory): number {
  if (left === right) {
    return 0;
  }
  if (left === UNCATEGORIZED_CATEGORY_LABEL) {
    return 1;
  }
  if (right === UNCATEGORIZED_CATEGORY_LABEL) {
    return -1;
  }
  return left.localeCompare(right, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function normalizeSkillLookupToken(value: string | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") ?? "";
}

function toTitleCaseWord(word: string): string {
  if (!word) {
    return "";
  }
  if (UPPERCASE_CATEGORY_TOKENS.has(word)) {
    return word.toUpperCase();
  }
  return `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
}

function formatSkillCategoryLabel(value: string | undefined): SkillCategory {
  const normalized = normalizeSkillLookupToken(value);
  if (!normalized) {
    return UNCATEGORIZED_CATEGORY_LABEL;
  }
  return normalized
    .split("-")
    .map((part) => toTitleCaseWord(part))
    .join(" ");
}

function resolveSkillCategory(
  skill: GatewaySkillStatusEntry,
  lookup?: SkillCategoryLookup | null,
): SkillCategory {
  const skillKeyToken = normalizeSkillLookupToken(skill.skillKey);
  const skillNameToken = normalizeSkillLookupToken(skill.name);
  return (
    (skillKeyToken ? lookup?.bySlug.get(skillKeyToken) : undefined)
    || (skillNameToken ? lookup?.bySlug.get(skillNameToken) : undefined)
    || (skillNameToken ? lookup?.byName.get(skillNameToken) : undefined)
    || UNCATEGORIZED_CATEGORY_LABEL
  );
}

function buildEmptySkillCategoryLookup(): SkillCategoryLookup {
  return {
    bySlug: new Map(),
    byName: new Map(),
  };
}

async function fetchSkillCategoryLookup(): Promise<SkillCategoryLookup> {
  const now = Date.now();
  if (cachedSkillCategoryLookup && cachedSkillCategoryLookupExpiresAt > now) {
    return cachedSkillCategoryLookup;
  }
  if (pendingSkillCategoryLookup) {
    return pendingSkillCategoryLookup;
  }

  pendingSkillCategoryLookup = runSupabaseRequestWithRetry(async ({ client }) => {
    const response = await client
      .schema("skillops")
      .from("skills")
      .select("slug, name, sub_layer")
      .eq("status", "enabled");

    if (response.error) {
      throw response.error;
    }

    const lookup = buildEmptySkillCategoryLookup();
    for (const row of (response.data ?? []) as SupabaseSkillCategoryRow[]) {
      const categoryLabel = formatSkillCategoryLabel(row.sub_layer ?? undefined);
      if (categoryLabel === UNCATEGORIZED_CATEGORY_LABEL) {
        continue;
      }
      const slugToken = normalizeSkillLookupToken(row.slug ?? undefined);
      const nameToken = normalizeSkillLookupToken(row.name ?? undefined);
      if (slugToken) {
        lookup.bySlug.set(slugToken, categoryLabel);
      }
      if (nameToken) {
        lookup.byName.set(nameToken, categoryLabel);
      }
    }
    cachedSkillCategoryLookup = lookup;
    cachedSkillCategoryLookupExpiresAt = Date.now() + SKILL_CATEGORY_CACHE_TTL_MS;
    return lookup;
  }, {
    operation: "list_skill_categories",
    force: false,
  }).catch(() => {
    const emptyLookup = buildEmptySkillCategoryLookup();
    cachedSkillCategoryLookup = emptyLookup;
    cachedSkillCategoryLookupExpiresAt = Date.now() + SKILL_CATEGORY_CACHE_TTL_MS;
    return emptyLookup;
  }).finally(() => {
    pendingSkillCategoryLookup = null;
  });

  return pendingSkillCategoryLookup;
}

export function toSkillCatalogItems(
  report: GatewaySkillStatusReport | null | undefined,
  options?: {
    categoryLookup?: SkillCategoryLookup | null;
  },
): SkillCatalogItem[] {
  const skills = Array.isArray(report?.skills) ? report.skills : [];
  return skills
    .map((skill, index) => {
      return {
        id: skill.skillKey?.trim() || `${skill.name.trim() || "skill"}-${index}`,
        name: skill.name.trim(),
        description: skill.description.trim(),
        source: skill.source.trim(),
        sourceLabel: resolveSkillSourceLabel(skill.source.trim()),
        skillKey: skill.skillKey.trim(),
        filePath: skill.filePath.trim(),
        homepage: skill.homepage?.trim() || undefined,
        primaryEnv: skill.primaryEnv?.trim() || undefined,
        eligible: skill.eligible !== false,
        bundled: skill.bundled === true || skill.source === "openclaw-bundled",
        category: resolveSkillCategory(skill, options?.categoryLookup),
        installOptions: Array.isArray(skill.install)
          ? skill.install
            .map((option) => ({
              id: option.id.trim(),
              kind: option.kind.trim(),
              label: option.label.trim(),
              bins: Array.isArray(option.bins)
                ? option.bins.map((bin) => String(bin).trim()).filter(Boolean)
                : [],
            }))
            .filter((option) => option.id && option.label)
          : [],
        installed: true,
        canInstall: false,
      };
    })
    .toSorted((left, right) => {
      const categoryDelta = compareSkillCategories(left.category, right.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }
      return compareSkillNames(left, right);
    });
}

export function getSkillCategoryOptions(items: SkillCatalogItem[]): SkillCategory[] {
  const categories = new Set<SkillCategory>();
  for (const item of items) {
    categories.add(item.category);
  }
  return [...categories].toSorted(compareSkillCategories);
}

export function recommendSkillNames(
  items: SkillCatalogItem[],
  params?: {
    limit?: number;
  },
): string[] {
  const recommended = CURATED_RECOMMENDED_SKILL_NAMES.filter((skillName) =>
    items.some((item) => item.name.toLowerCase() === skillName.toLowerCase()),
  );
  if (recommended.length === 0) {
    return [];
  }
  const limit = params?.limit ? Math.max(1, params.limit) : null;
  return limit ? recommended.slice(0, limit) : recommended;
}

export async function fetchSkillStatusReport(params?: {
  agentId?: string;
  scope?: string;
}): Promise<GatewaySkillStatusReport> {
  return await requestBustlyGatewayMethod<GatewaySkillStatusReport>({
    method: "skills.status",
    payload: params?.agentId ? { agentId: params.agentId } : {},
    scope: params?.scope,
  });
}

export async function fetchSkillCatalog(params?: {
  agentId?: string;
  scope?: string;
  surface?: "agent" | "hub";
}): Promise<SkillCatalogItem[]> {
  if (params?.surface === "hub") {
    const items = await listGlobalSkillCatalog();
    return items
      .map((item) => ({
        id: item.id.trim(),
        name: item.name.trim(),
        description: item.description.trim(),
        source: item.source.trim(),
        sourceLabel: item.sourceLabel.trim(),
        skillKey: item.skillKey.trim(),
        filePath: item.filePath.trim(),
        homepage: item.homepage?.trim() || undefined,
        primaryEnv: item.primaryEnv?.trim() || undefined,
        eligible: item.eligible === true,
        bundled: item.bundled === true,
        category: item.category.trim() || UNCATEGORIZED_CATEGORY_LABEL,
        installOptions: [],
        installed: item.installed === true,
        canInstall: item.canInstall === true,
      }))
      .toSorted((left, right) => {
        const categoryDelta = compareSkillCategories(left.category, right.category);
        if (categoryDelta !== 0) {
          return categoryDelta;
        }
        return compareSkillNames(left, right);
      });
  }
  const [report, categoryLookup] = await Promise.all([
    fetchSkillStatusReport(params),
    fetchSkillCategoryLookup(),
  ]);
  return toSkillCatalogItems(report, { categoryLookup });
}

export async function installSkillCatalogItem(params: {
  skillName: string;
  skillKey: string;
  installId?: string;
  timeoutMs?: number;
  scope?: string;
}): Promise<void> {
  if (!params.installId) {
    await installGlobalSkillCatalogItemViaGateway(params.skillKey);
    return;
  }
  await requestBustlyGatewayMethod({
    method: "skills.install",
    payload: {
      name: params.skillName,
      installId: params.installId,
      ...(typeof params.timeoutMs === "number" ? { timeoutMs: params.timeoutMs } : {}),
    },
    scope: params.scope,
  });
}
