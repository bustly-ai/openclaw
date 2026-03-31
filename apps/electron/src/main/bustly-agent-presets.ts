import { normalizeBustlyAgentName, DEFAULT_BUSTLY_AGENT_NAME } from "../shared/bustly-agent.js";

export type BustlyRemoteUseCase = {
  icon: string;
  label: string;
  prompt: string;
};

export type BustlyRemoteAgentPreset = {
  slug: string;
  label: string;
  icon: string;
  order: number;
  enabled?: boolean;
  isMain?: boolean;
  model?: string;
  description?: string;
  useCases?: BustlyRemoteUseCase[];
};

type BustlyRemoteAgentConfig = {
  version?: number;
  agents?: unknown;
};

let presetsPromise: Promise<BustlyRemoteAgentPreset[]> | null = null;

const FALLBACK_AGENT_PRESETS: BustlyRemoteAgentPreset[] = [
  {
    slug: "overview",
    label: "Overview",
    icon: "Robot",
    order: 0,
    enabled: true,
    isMain: true,
    description: "Automatically spots the most important business changes today.",
    useCases: [
      {
        icon: "ChartPie",
        label: "Daily Pulse",
        prompt: "Surface the most important business changes of the day across revenue, orders, customers, and risk signals.",
      },
      {
        icon: "MagnifyingGlass",
        label: "Anomaly Detection",
        prompt: "Detect cross-channel anomalies and rank the issues that need attention first, such as refund spikes, stockout risk, or order backlog.",
      },
      {
        icon: "Robot",
        label: "Executive Hub",
        prompt: "Act as the command center that routes users from a high-level business summary into the right specialized channel for deeper analysis.",
      },
    ],
  },
  {
    slug: "marketing",
    label: "Marketing",
    icon: "TrendUp",
    order: 10,
    enabled: true,
    useCases: [
      {
        icon: "TrendUp",
        label: "Campaign Diagnosis",
        prompt: "Identify which campaigns and acquisition channels are driving efficient growth versus wasting budget.",
      },
      {
        icon: "ChartBar",
        label: "Budget Guidance",
        prompt: "Recommend where to cut spend, where to scale, and which campaigns need immediate optimization.",
      },
      {
        icon: "MagnifyingGlass",
        label: "Funnel Analysis",
        prompt: "Pinpoint where demand is leaking across the funnel, from traffic to click, conversion, and checkout.",
      },
    ],
  },
  {
    slug: "store-ops",
    label: "Store Ops",
    icon: "Storefront",
    order: 20,
    enabled: true,
    useCases: [
      {
        icon: "ClockCounterClockwise",
        label: "Fulfillment Risk",
        prompt: "Highlight overdue, unfulfilled, or exception orders so operators can act before delays impact customer experience.",
      },
      {
        icon: "Package",
        label: "Inventory Risk",
        prompt: "Detect low-stock and high-velocity SKUs that are likely to stock out in the next 7-14 days.",
      },
      {
        icon: "WarningCircle",
        label: "Product Issues",
        prompt: "Surface products with abnormal sales drops, high return rates, or unusual discount pressure.",
      },
    ],
  },
  {
    slug: "customers",
    label: "Customers",
    icon: "Users",
    order: 30,
    enabled: true,
    useCases: [
      {
        icon: "Users",
        label: "Customer Mix",
        prompt: "Show whether growth is driven by healthy repeat demand or by one-time acquisition.",
      },
      {
        icon: "Heart",
        label: "Retention Opps",
        prompt: "Identify at-risk customer cohorts and uncover segments that are most worth re-engaging.",
      },
      {
        icon: "ChatCircleText",
        label: "High-Value Customers",
        prompt: "Reveal which customer segments contribute the most long-term value, repeat revenue, and profitability.",
      },
    ],
  },
  {
    slug: "finance",
    label: "Finance",
    icon: "Wallet",
    order: 40,
    enabled: true,
    useCases: [
      {
        icon: "ChartPie",
        label: "Revenue Quality",
        prompt: "Evaluate business performance beyond top-line sales by focusing on net sales, margin quality, and revenue composition.",
      },
      {
        icon: "CreditCard",
        label: "Discount Leakage",
        prompt: "Quantify how discounts and refunds are eroding revenue and trace the impact back to products, campaigns, or customer groups.",
      },
      {
        icon: "Wallet",
        label: "Health Signals",
        prompt: "Turn financial metrics into clear business signals, such as rising discount dependency or concentrated refund pressure.",
      },
    ],
  },
];

function cloneFallbackPresets(): BustlyRemoteAgentPreset[] {
  return FALLBACK_AGENT_PRESETS.map((entry) => ({
    ...entry,
    useCases: entry.useCases?.map((useCase) => ({ ...useCase })) ?? [],
  }));
}

function logPresetWarning(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.warn(`[Bustly Agent Presets] ${message}`);
    return;
  }
  console.warn(`[Bustly Agent Presets] ${message}`, extra);
}

function resolveAgentConfigUrl(env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Missing BUSTLY_WORKSPACE_TEMPLATE_BASE_URL for Bustly agent config.");
  }
  return `${baseUrl}/agents/config.json`;
}

function validatePresets(raw: BustlyRemoteAgentConfig): BustlyRemoteAgentPreset[] {
  const rawAgents = Array.isArray(raw.agents) ? raw.agents : null;
  if (!rawAgents || rawAgents.length === 0) {
    throw new Error("Bustly agent config is missing agents[].");
  }

  const presets = rawAgents
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as Record<string, unknown>;
      const slug = normalizeBustlyAgentName(typeof candidate.slug === "string" ? candidate.slug : "");
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      const icon = typeof candidate.icon === "string" ? candidate.icon.trim() : "";
      const order = typeof candidate.order === "number" && Number.isFinite(candidate.order) ? candidate.order : null;
      if (!slug || !label || !icon || order == null) {
        return null;
      }
      return {
        slug,
        label,
        icon,
        order,
        enabled: candidate.enabled === false ? false : true,
        isMain: candidate.isMain === true,
        model: typeof candidate.model === "string" ? candidate.model.trim() || undefined : undefined,
        description:
          typeof candidate.description === "string" ? candidate.description.trim() || undefined : undefined,
        useCases: Array.isArray(candidate.useCases)
          ? candidate.useCases.flatMap((rawUseCase) => {
              if (!rawUseCase || typeof rawUseCase !== "object") {
                return [];
              }
              const useCase = rawUseCase as Record<string, unknown>;
              const useCaseIcon = typeof useCase.icon === "string" ? useCase.icon.trim() : "";
              const useCaseLabel = typeof useCase.label === "string" ? useCase.label.trim() : "";
              const prompt = typeof useCase.prompt === "string" ? useCase.prompt.trim() : "";
              if (!useCaseIcon || !useCaseLabel || !prompt) {
                return [];
              }
              return [{ icon: useCaseIcon, label: useCaseLabel, prompt }];
            })
          : [],
      } satisfies BustlyRemoteAgentPreset;
    })
    .filter((entry): entry is BustlyRemoteAgentPreset => entry != null);

  if (presets.length === 0) {
    throw new Error("Bustly agent config has no valid agents.");
  }
  if (!presets.some((entry) => entry.slug === DEFAULT_BUSTLY_AGENT_NAME)) {
    throw new Error(`Bustly agent config must include a main agent (${DEFAULT_BUSTLY_AGENT_NAME}).`);
  }
  return presets.toSorted((left, right) => left.order - right.order);
}

export async function loadBustlyRemoteAgentPresets(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BustlyRemoteAgentPreset[]> {
  if (!presetsPromise) {
    presetsPromise = (async () => {
      try {
        const response = await fetch(resolveAgentConfigUrl(env));
        if (!response.ok) {
          throw new Error(`Failed to fetch Bustly agent config: ${response.status} ${response.statusText}`);
        }
        const parsed = (await response.json()) as BustlyRemoteAgentConfig;
        return validatePresets(parsed);
      } catch (error) {
        logPresetWarning("remote config unavailable; using bundled fallback presets", {
          error: error instanceof Error ? error.message : String(error),
        });
        return cloneFallbackPresets();
      }
    })();
  }
  return await presetsPromise;
}

export async function loadEnabledBustlyRemoteAgentPresets(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BustlyRemoteAgentPreset[]> {
  const presets = await loadBustlyRemoteAgentPresets(env);
  return presets.filter((entry) => entry.enabled !== false);
}

export async function loadBustlyMainAgentPreset(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BustlyRemoteAgentPreset> {
  const presets = await loadEnabledBustlyRemoteAgentPresets(env);
  return (
    presets.find((entry) => entry.isMain) ??
    presets.find((entry) => entry.slug === DEFAULT_BUSTLY_AGENT_NAME) ??
    presets[0]
  );
}

export function resetBustlyRemoteAgentPresetsCache(): void {
  presetsPromise = null;
}
