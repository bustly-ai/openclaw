import {
  normalizeBustlyAgentMetadata,
  type BustlyAgentUseCase,
  type BustlyAgentMetadata,
} from "../agents/bustly-agent-metadata.js";
import { loadRemoteWorkspaceTemplate } from "../agents/workspace-remote-templates.js";
import { DEFAULT_BUSTLY_AGENT_NAME, normalizeBustlyAgentName } from "./workspace-agent.js";

export type BustlyRemoteAgentPreset = {
  slug: string;
};
export type BustlyRemoteUseCase = BustlyAgentUseCase;

type BustlyAgentPresetLoaderOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  onWarn?: (message: string, extra?: unknown) => void;
};

let presetsPromise: Promise<BustlyRemoteAgentPreset[]> | null = null;
const AGENT_CONFIG_PATH = "agents/config.json";

const FALLBACK_AGENT_METADATA_BY_SLUG: Record<string, BustlyAgentMetadata> = {
  overview: {
    label: "Overview",
    icon: "Web3_Avatar.png",
    skills: ["ads-core-ops", "commerce-core-ops"],
    useCases: [
      {
        label: "Daily Pulse",
        prompt:
          "Surface the most important business changes of the day across revenue, orders, customers, and risk signals.",
      },
      {
        label: "Anomaly Detection",
        prompt:
          "Detect cross-channel anomalies and rank the issues that need attention first, such as refund spikes, stockout risk, or order backlog.",
      },
      {
        label: "Executive Hub",
        prompt:
          "Act as the command center that routes users from a high-level business summary into the right specialized channel for deeper analysis.",
      },
    ],
  },
  finance: {
    label: "Finance",
    icon: "Web3_Avatar_4.png",
    skills: ["ads-core-ops", "commerce-core-ops"],
    useCases: [
      {
        label: "Revenue Quality",
        prompt:
          "Evaluate business performance beyond top-line sales by focusing on net sales, margin quality, and revenue composition.",
      },
      {
        label: "Discount Leakage",
        prompt:
          "Quantify how discounts and refunds are eroding revenue and trace the impact back to products, campaigns, or customer groups.",
      },
      {
        label: "Health Signals",
        prompt:
          "Turn financial metrics into clear business signals, such as rising discount dependency or concentrated refund pressure.",
      },
    ],
  },
  customers: {
    label: "Customers",
    icon: "Web3_Avatar_3.png",
    skills: ["commerce-core-ops"],
    useCases: [
      {
        label: "Customer Mix",
        prompt:
          "Show whether growth is driven by healthy repeat demand or by one-time acquisition.",
      },
      {
        label: "Retention Opps",
        prompt:
          "Identify at-risk customer cohorts and uncover segments that are most worth re-engaging.",
      },
      {
        label: "High-Value Customers",
        prompt:
          "Reveal which customer segments contribute the most long-term value, repeat revenue, and profitability.",
      },
    ],
  },
  "store-ops": {
    label: "Store Ops",
    icon: "Web3_Avatar_2.png",
    skills: ["commerce-core-ops"],
    useCases: [
      {
        label: "Fulfillment Risk",
        prompt:
          "Highlight overdue, unfulfilled, or exception orders so operators can act before delays impact customer experience.",
      },
      {
        label: "Inventory Risk",
        prompt:
          "Detect low-stock and high-velocity SKUs that are likely to stock out in the next 7-14 days.",
      },
      {
        label: "Product Issues",
        prompt:
          "Surface products with abnormal sales drops, high return rates, or unusual discount pressure.",
      },
    ],
  },
  marketing: {
    label: "Marketing",
    icon: "Web3_Avatar_1.png",
    skills: ["ads-core-ops", "commerce-core-ops"],
    useCases: [
      {
        label: "Campaign Diagnosis",
        prompt:
          "Identify which campaigns and acquisition channels are driving efficient growth versus wasting budget.",
      },
      {
        label: "Budget Guidance",
        prompt:
          "Recommend where to cut spend, where to scale, and which campaigns need immediate optimization.",
      },
      {
        label: "Funnel Analysis",
        prompt:
          "Pinpoint where demand is leaking across the funnel, from traffic to click, conversion, and checkout.",
      },
    ],
  },
};

const FALLBACK_AGENT_PRESETS: BustlyRemoteAgentPreset[] = [
  { slug: "overview" },
  { slug: "finance" },
  { slug: "customers" },
  { slug: "store-ops" },
  { slug: "marketing" },
];

function cloneFallbackPresets(): BustlyRemoteAgentPreset[] {
  return FALLBACK_AGENT_PRESETS.map((entry) => ({ ...entry }));
}

function cloneFallbackMetadata(agentName: string): BustlyAgentMetadata | undefined {
  const metadata = FALLBACK_AGENT_METADATA_BY_SLUG[normalizeBustlyAgentName(agentName)];
  if (!metadata) {
    return undefined;
  }
  return {
    ...(metadata.label ? { label: metadata.label } : {}),
    ...(metadata.icon ? { icon: metadata.icon } : {}),
    ...(metadata.skills ? { skills: [...metadata.skills] } : {}),
    ...(metadata.useCases ? { useCases: metadata.useCases.map((useCase) => ({ ...useCase })) } : {}),
  };
}

function logPresetWarning(
  options: BustlyAgentPresetLoaderOptions,
  message: string,
  extra?: unknown,
): void {
  if (options.onWarn) {
    options.onWarn(message, extra);
    return;
  }
  if (extra === undefined) {
    console.warn(`[Bustly Agent Presets] ${message}`);
    return;
  }
  console.warn(`[Bustly Agent Presets] ${message}`, extra);
}

async function loadBustlyPromptFile(
  name: string,
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<string | undefined> {
  return await loadRemoteWorkspaceTemplate(name, {
    env: options.env,
    fetchImpl: options.fetchImpl,
  });
}

function validatePresets(raw: unknown): BustlyRemoteAgentPreset[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Bustly agent config must be a non-empty array.");
  }

  const presets: BustlyRemoteAgentPreset[] = [];
  for (const entry of raw) {
    const rawSlug = typeof entry === "string" ? entry.trim() : "";
    if (!rawSlug) {
      continue;
    }
    const slug = normalizeBustlyAgentName(rawSlug);
    if (!slug) {
      continue;
    }
    presets.push({ slug });
  }

  if (presets.length === 0) {
    throw new Error("Bustly agent config has no valid agents.");
  }
  if (!presets.some((entry) => entry.slug === DEFAULT_BUSTLY_AGENT_NAME)) {
    throw new Error(
      `Bustly agent config must include a main agent (${DEFAULT_BUSTLY_AGENT_NAME}).`,
    );
  }
  return presets;
}

export async function loadBustlyRemoteAgentPresets(
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyRemoteAgentPreset[]> {
  if (!presetsPromise) {
    presetsPromise = (async () => {
      try {
        const raw = await loadBustlyPromptFile(AGENT_CONFIG_PATH, options);
        if (!raw?.trim()) {
          throw new Error(`Missing Bustly agent config at ${AGENT_CONFIG_PATH}.`);
        }
        const parsed = JSON.parse(raw);
        return validatePresets(parsed);
      } catch (error) {
        logPresetWarning(options, "remote config unavailable; using bundled fallback presets", {
          error: error instanceof Error ? error.message : String(error),
        });
        return cloneFallbackPresets();
      }
    })();
  }
  return await presetsPromise;
}

export async function loadEnabledBustlyRemoteAgentPresets(
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyRemoteAgentPreset[]> {
  return await loadBustlyRemoteAgentPresets(options);
}

export async function loadBustlyMainAgentPreset(
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyRemoteAgentPreset> {
  const presets = await loadEnabledBustlyRemoteAgentPresets(options);
  return presets.find((entry) => entry.slug === DEFAULT_BUSTLY_AGENT_NAME) ?? presets[0];
}

export function resetBustlyRemoteAgentPresetsCache(): void {
  presetsPromise = null;
}

export async function loadBustlyRemoteAgentMetadata(
  agentName: string,
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyAgentMetadata> {
  const normalizedAgentName = normalizeBustlyAgentName(agentName);
  const metadataPath = `agents/${normalizedAgentName}/.bustly-agent.json`;
  const raw = await loadBustlyPromptFile(metadataPath, options);
  if (!raw?.trim()) {
    const fallbackMetadata = cloneFallbackMetadata(normalizedAgentName);
    if (fallbackMetadata) {
      return fallbackMetadata;
    }
    throw new Error(`Missing Bustly agent metadata at ${metadataPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid Bustly agent metadata at ${metadataPath}.`, {
      cause: error,
    });
  }

  const metadata = normalizeBustlyAgentMetadata(parsed);
  if (!metadata.label) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include label.`);
  }
  if (!metadata.icon) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include icon.`);
  }
  if (metadata.skills === undefined) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include skills.`);
  }
  if (metadata.useCases === undefined) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include useCases.`);
  }
  return metadata;
}
