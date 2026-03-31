import type { SessionIconId } from "../renderer/lib/session-icons.js";
import {
  buildBustlyWorkspaceMainSessionKey,
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
  order: number;
  enabled?: boolean;
  model?: string;
  useCases: BustlyPresetUseCase[];
};

export const BUSTLY_MAIN_AGENT_PRESET = {
  label: "Overview",
  icon: "Robot" as const,
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
};

export const BUSTLY_PRESET_CHANNELS: BustlyPresetChannel[] = [
  {
    slug: "daily-ops",
    label: "Marketing",
    icon: "TrendUp",
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
  },
  {
    slug: "campaigns",
    label: "Store Ops",
    icon: "Storefront",
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
  },
  {
    slug: "inventory",
    label: "Customers",
    icon: "Users",
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
  },
  {
    slug: "support",
    label: "Finance",
    icon: "Wallet",
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
  },
];

export function resolveBustlyPresetUseCases(params: {
  sessionKey: string;
  workspaceId?: string | null;
}): BustlyPresetUseCase[] {
  const workspaceMainSessionKey = buildBustlyWorkspaceMainSessionKey(params.workspaceId);
  if (params.sessionKey === workspaceMainSessionKey) {
    return BUSTLY_MAIN_AGENT_PRESET.useCases;
  }
  const agentName = resolveBustlyAgentNameFromSessionKey(params.workspaceId, params.sessionKey);
  const scenario = BUSTLY_PRESET_CHANNELS.find((entry) => entry.slug === agentName);
  return scenario?.useCases ?? [];
}
