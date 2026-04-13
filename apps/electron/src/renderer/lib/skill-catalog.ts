import { GatewayBrowserClient } from "./gateway-client";
import { createGatewayInstanceId } from "./gateway-instance-id";
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

const COMMON_SEARCH_WORDS = new Set([
  "a",
  "an",
  "and",
  "assistant",
  "build",
  "for",
  "from",
  "help",
  "in",
  "of",
  "on",
  "or",
  "skill",
  "skills",
  "the",
  "to",
  "with",
  "your",
]);

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

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !COMMON_SEARCH_WORDS.has(token));
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
    roleText?: string;
    vibe?: string;
    limit?: number;
  },
): string[] {
  const limit = Math.max(1, params?.limit ?? 4);
  const targetTokens = tokenizeText(`${params?.roleText ?? ""} ${params?.vibe ?? ""}`);
  const targetTokenSet = new Set(targetTokens);

  const scored = items
    .map((item) => {
      const itemTokenSet = new Set(
        tokenizeText(
          [item.name, item.description, item.sourceLabel, item.primaryEnv ?? "", item.category].join(" "),
        ),
      );

      let score = 0;
      for (const token of targetTokenSet) {
        if (itemTokenSet.has(token)) {
          score += token.length >= 6 ? 4 : 2;
        }
      }
      if (item.eligible) {
        score += 2;
      }
      if (item.bundled) {
        score += 1;
      }
      if (
        item.source === "openclaw-workspace"
        || item.source === "agents-skills-personal"
        || item.source === "agents-skills-project"
      ) {
        score += 1;
      }
      return { name: item.name, score };
    })
    .toSorted((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return compareSkillNames(left, right);
    });

  const recommended = scored.filter((entry) => entry.score > 0).slice(0, limit).map((entry) => entry.name);
  if (recommended.length > 0) {
    return recommended;
  }

  return items
    .filter((item) => item.eligible)
    .slice(0, limit)
    .map((item) => item.name);
}

async function requestSkillGatewayMethod<T>(params: {
  method: string;
  payload?: unknown;
  scope?: string;
}): Promise<T> {
  const gatewayStatus = await window.electronAPI.gatewayStatus();
  if (!gatewayStatus.running) {
    throw new Error("Gateway is not running.");
  }

  const connection = await window.electronAPI.gatewayConnectConfig();
  if (!connection.token || !connection.wsUrl) {
    throw new Error("Gateway token missing in config; cannot load skills.");
  }

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const client = new GatewayBrowserClient({
      url: connection.wsUrl,
      token: connection.token ?? undefined,
      clientName: "openclaw-control-ui",
      mode: "webchat",
      instanceId: createGatewayInstanceId(params.scope ?? "skills"),
      onHello: () => {
        void client
          .request<T>(params.method, params.payload)
          .then((report) => {
            if (settled) {
              return;
            }
            settled = true;
            client.stop();
            resolve(report);
          })
          .catch((error) => {
            if (settled) {
              return;
            }
            settled = true;
            client.stop();
            reject(error);
          });
      },
      onClose: ({ error, reason }) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(error?.message || reason || "Gateway disconnected."));
      },
    });

    client.start();
  });
}

export async function fetchSkillStatusReport(params?: {
  agentId?: string;
  scope?: string;
}): Promise<GatewaySkillStatusReport> {
  return await requestSkillGatewayMethod<GatewaySkillStatusReport>({
    method: "skills.status",
    payload: params?.agentId ? { agentId: params.agentId } : {},
    scope: params?.scope,
  });
}

export async function fetchSkillCatalog(params?: {
  agentId?: string;
  scope?: string;
}): Promise<SkillCatalogItem[]> {
  const [report, categoryLookup] = await Promise.all([
    fetchSkillStatusReport(params),
    fetchSkillCategoryLookup(),
  ]);
  return toSkillCatalogItems(report, { categoryLookup });
}

export async function installSkillCatalogItem(params: {
  skillName: string;
  installId: string;
  timeoutMs?: number;
  scope?: string;
}): Promise<void> {
  await requestSkillGatewayMethod({
    method: "skills.install",
    payload: {
      name: params.skillName,
      installId: params.installId,
      ...(typeof params.timeoutMs === "number" ? { timeoutMs: params.timeoutMs } : {}),
    },
    scope: params.scope,
  });
}
