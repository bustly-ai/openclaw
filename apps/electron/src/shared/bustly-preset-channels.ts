import type { SessionIconId } from "../renderer/lib/session-icons.js";
import {
  DEFAULT_BUSTLY_AGENT_NAME,
  normalizeBustlyAgentName,
  resolveBustlyAgentNameFromAgentId,
  resolveBustlyAgentNameFromSessionKey,
} from "./bustly-agent.js";

export type BustlyPresetUseCase = {
  icon: string;
  label: string;
  prompt: string;
};

export type BustlyPresetChannel = {
  slug: string;
  label: string;
  icon: SessionIconId;
  avatar: string;
  description: string;
  order: number;
  enabled?: boolean;
  model?: string;
  useCases: BustlyPresetUseCase[];
};

function createBustlyPresetChannel(
  channel: Omit<BustlyPresetChannel, "slug"> & { slug?: string },
): BustlyPresetChannel {
  return {
    ...channel,
    // Keep the persisted agent slug aligned with the visible label.
    slug: normalizeBustlyAgentName(channel.slug ?? channel.label),
  };
}

export const BUSTLY_MAIN_AGENT_PRESET = {
  label: "Overview",
  icon: "Robot" as const,
  avatar: "Web3_Avatar.png",
  description: "How can I help you today?",
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
};

export const BUSTLY_PRESET_CHANNELS: BustlyPresetChannel[] = [
  createBustlyPresetChannel({
    label: "Marketing",
    icon: "TrendUp",
    avatar: "Web3_Avatar_1.png",
    description: "Highlights wasted spend and recommends where to move budget.",
    order: 10,
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
  }),
  createBustlyPresetChannel({
    label: "Store Ops",
    icon: "Storefront",
    avatar: "Web3_Avatar_2.png",
    description: "Flags stockout, inventory backlog, and operational risks early.",
    order: 20,
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
  }),
  createBustlyPresetChannel({
    label: "Customers",
    icon: "Users",
    avatar: "Web3_Avatar_3.png",
    description: "Identifies churn-risk segments and high-value customer opportunities.",
    order: 30,
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
  }),
  createBustlyPresetChannel({
    label: "Finance",
    icon: "Wallet",
    avatar: "Web3_Avatar_4.png",
    description: "Explains how discounts, refunds, and fees affect true net revenue.",
    order: 40,
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
  }),
];

export function resolveBustlyPresetUseCases(params: {
  sessionKey?: string | null;
  agentId?: string | null;
  workspaceId?: string | null;
}): BustlyPresetUseCase[] {
  const channel = resolveBustlyPresetChannel(params);
  return channel?.useCases?.map((useCase) => ({ ...useCase })) ?? [];
}

export function resolveBustlyPresetChannel(params: {
  sessionKey?: string | null;
  agentId?: string | null;
  workspaceId?: string | null;
}) {
  const agentName =
    resolveBustlyAgentNameFromSessionKey(params.workspaceId, params.sessionKey) ||
    resolveBustlyAgentNameFromAgentId(params.workspaceId, params.agentId);
  if (agentName === DEFAULT_BUSTLY_AGENT_NAME) {
    return {
      ...BUSTLY_MAIN_AGENT_PRESET,
      slug: DEFAULT_BUSTLY_AGENT_NAME,
      order: 0,
      enabled: true,
      useCases: BUSTLY_MAIN_AGENT_PRESET.useCases.map((useCase) => ({ ...useCase })),
    } satisfies BustlyPresetChannel;
  }
  const scenario = BUSTLY_PRESET_CHANNELS.find((entry) => entry.slug === agentName);
  return scenario
    ? {
        ...scenario,
        useCases: scenario.useCases.map((useCase) => ({ ...useCase })),
      }
    : null;
}
