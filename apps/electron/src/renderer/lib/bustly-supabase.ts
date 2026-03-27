import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type WorkspaceMemberCountRow = {
  workspace_id: string;
};

type WorkspaceSubscriptionRow = {
  id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string | null;
  trial_end_at: string | null;
  cancel_at_period_end: boolean;
  benefit_plan:
    | {
        code: string | null;
        name: string | null;
        tier: string | null;
        billing_cycle?: string | null;
      }
    | {
        code: string | null;
        name: string | null;
        tier: string | null;
        billing_cycle?: string | null;
      }[]
    | null;
};

type BenefitPlanRow = {
  id: string;
  code: string | null;
  name: string | null;
  tier: string | null;
  billing_cycle: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
  logo_url: string | null;
  status: string;
  workspace_members:
    | {
        role: string;
        user_id: string;
      }[]
    | null;
  workspace_subscriptions: WorkspaceSubscriptionRow[] | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
  role: string;
  status: string;
  members: number;
  plan: string | null;
  expired: boolean;
  planDisplayText: string;
  badge: string;
  expirationText: string;
  buttonText: string;
  planStatus: "none" | "active" | "expired" | "canceled";
};

type WorkspaceSummaryResult = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
};

type ResolvedBenefitPlan = {
  code: string | null;
  name: string | null;
  tier: string | null;
  billing_cycle: string | null;
};

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPlanDate(value: string | null | undefined): string {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function resolveBenefitPlan(
  subscription?: WorkspaceSubscriptionRow,
  planById?: Map<string, BenefitPlanRow>,
): ResolvedBenefitPlan | null {
  const directPlan = Array.isArray(subscription?.benefit_plan)
    ? subscription?.benefit_plan[0]
    : subscription?.benefit_plan;
  if (directPlan) {
    return {
      code: directPlan.code ?? null,
      name: directPlan.name ?? null,
      tier: directPlan.tier ?? null,
      billing_cycle: directPlan.billing_cycle ?? null,
    };
  }
  if (subscription?.plan_id && planById?.has(subscription.plan_id)) {
    const linkedPlan = planById.get(subscription.plan_id)!;
    return {
      code: linkedPlan.code ?? null,
      name: linkedPlan.name ?? null,
      tier: linkedPlan.tier ?? null,
      billing_cycle: linkedPlan.billing_cycle ?? null,
    };
  }
  return null;
}

function resolvePlanLabel(
  subscription?: WorkspaceSubscriptionRow,
  planById?: Map<string, BenefitPlanRow>,
): string | null {
  const benefitPlan = resolveBenefitPlan(subscription, planById);
  return (
    benefitPlan?.name?.trim() ||
    benefitPlan?.tier?.trim() ||
    benefitPlan?.code?.trim() ||
    null
  );
}

function resolveWorkspacePlanState(
  subscription: WorkspaceSubscriptionRow | undefined,
  planById: Map<string, BenefitPlanRow>,
): Pick<
  WorkspaceSummary,
  "plan" | "expired" | "planDisplayText" | "badge" | "expirationText" | "buttonText" | "planStatus"
> {
  const now = Date.now();
  const status = subscription?.status?.trim().toLowerCase() ?? "";
  const currentPeriodEnd = parseTimestamp(subscription?.current_period_end);
  const trialEndAt = parseTimestamp(subscription?.trial_end_at);
  const isTrial = Boolean(trialEndAt && trialEndAt > now);
  const hasPeriodEnded = Boolean(currentPeriodEnd && currentPeriodEnd < now);
  const isCanceled = status === "pending_cancellation";
  const isCanceledButStillActive = status === "canceled" && Boolean(currentPeriodEnd && currentPeriodEnd >= now);
  const isExpired = hasPeriodEnded || status === "expired" || (status === "canceled" && !isCanceledButStillActive);
  const planLabel = subscription ? (resolvePlanLabel(subscription, planById) || "Basic") : null;
  const planDisplayText = planLabel || "";

  if (!subscription) {
    return {
      plan: null,
      expired: false,
      planDisplayText: "",
      badge: "",
      expirationText: "",
      buttonText: "Manage",
      planStatus: "none",
    };
  }

  if (isExpired) {
    return {
      plan: planLabel,
      expired: true,
      planDisplayText: "Plan Expired",
      badge: "",
      expirationText: "",
      buttonText: "Upgrade",
      planStatus: "expired",
    };
  }

  if (isTrial) {
    return {
      plan: planLabel,
      expired: false,
      planDisplayText,
      badge: "Trial",
      expirationText: subscription.trial_end_at ? `Will renew on ${formatPlanDate(subscription.trial_end_at)}.` : "",
      buttonText: "Manage",
      planStatus: "active",
    };
  }

  if ((isCanceled || isCanceledButStillActive) && currentPeriodEnd !== null) {
    const daysLeft = Math.max(0, Math.ceil((currentPeriodEnd - now) / (1000 * 60 * 60 * 24)));
    return {
      plan: planLabel,
      expired: false,
      planDisplayText,
      badge: "",
      expirationText:
        daysLeft < 7
          ? `${daysLeft} days left.`
          : `Expires on ${formatPlanDate(subscription.current_period_end)}.`,
      buttonText: "Renew",
      planStatus: "canceled",
    };
  }

  if (subscription.current_period_end) {
    return {
      plan: planLabel,
      expired: false,
      planDisplayText,
      badge: "",
      expirationText: `Will renew on ${formatPlanDate(subscription.current_period_end)}.`,
      buttonText: "Manage",
      planStatus: "active",
    };
  }

  return {
    plan: planLabel,
    expired: false,
    planDisplayText,
    badge: "",
    expirationText: "",
    buttonText: "Manage",
    planStatus: "active",
  };
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = "";
let cachedWorkspaceSummaryKey = "";
let cachedWorkspaceSummaryExpiresAt = 0;
let cachedWorkspaceSummaryResult: WorkspaceSummaryResult | null = null;
let pendingWorkspaceSummaryKey = "";
let pendingWorkspaceSummaryPromise: Promise<WorkspaceSummaryResult> | null = null;
const WORKSPACE_SUMMARY_CACHE_TTL_MS = 2_000;

function buildSupabaseConfigKey(config: BustlySupabaseConfig): string {
  return [
    config.url,
    config.anonKey,
    config.accessToken,
    config.userId,
    config.workspaceId,
  ].join("|");
}

async function getSupabaseConfig(): Promise<BustlySupabaseConfig> {
  const config = await window.electronAPI.bustlyGetSupabaseConfig();
  if (!config?.url || !config.anonKey || !config.accessToken || !config.userId) {
    throw new Error("Missing Bustly Supabase config");
  }
  return config;
}

export async function getBustlySupabaseClient(): Promise<{
  client: SupabaseClient;
  config: BustlySupabaseConfig;
}> {
  const config = await getSupabaseConfig();
  const configKey = buildSupabaseConfigKey(config);
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      },
    });
    cachedConfigKey = configKey;
  }
  return {
    client: cachedClient,
    config,
  };
}

export function invalidateWorkspaceSummariesCache(): void {
  cachedWorkspaceSummaryKey = "";
  cachedWorkspaceSummaryExpiresAt = 0;
  cachedWorkspaceSummaryResult = null;
}

export async function listWorkspaceSummaries(options?: { force?: boolean }): Promise<WorkspaceSummaryResult> {
  const config = await getSupabaseConfig();
  const configKey = buildSupabaseConfigKey(config);
  const force = options?.force === true;
  const now = Date.now();

  if (
    !force &&
    cachedWorkspaceSummaryResult &&
    cachedWorkspaceSummaryKey === configKey &&
    cachedWorkspaceSummaryExpiresAt > now
  ) {
    return cachedWorkspaceSummaryResult;
  }

  if (pendingWorkspaceSummaryPromise && pendingWorkspaceSummaryKey === configKey) {
    return pendingWorkspaceSummaryPromise;
  }

  const pendingRequest = (async () => {
    const { client } = await getBustlySupabaseClient();
    const workspacesRes = await client
      .from("workspaces")
      .select(`
        id,
        name,
        logo_url,
        status,
        workspace_members (
          role,
          user_id
        ),
        workspace_subscriptions (
          id,
          plan_id,
          status,
          current_period_end,
          trial_end_at,
          cancel_at_period_end,
          benefit_plan:benefit_plan!workspace_subscriptions_plan_id_fkey (
            code,
            name,
            tier,
            billing_cycle
          )
        )
      `)
      .eq("status", "ACTIVE")
      .eq("workspace_members.user_id", config.userId)
      .order("created_at", { ascending: false });

    if (workspacesRes.error) {
      throw workspacesRes.error;
    }

    const workspaceRows = (workspacesRes.data ?? []) as unknown as WorkspaceRow[];
    const workspaceIds = workspaceRows.map((item) => item.id).filter(Boolean);
    if (workspaceIds.length === 0) {
      return { workspaces: [], activeWorkspaceId: "" };
    }

    const memberCountsRes = await client
      .from("workspace_members")
      .select("workspace_id")
      .in("workspace_id", workspaceIds)
      .eq("status", "ACTIVE");

    if (memberCountsRes.error) {
      throw memberCountsRes.error;
    }

    const memberCounts = new Map<string, number>();
    for (const row of (memberCountsRes.data ?? []) as WorkspaceMemberCountRow[]) {
      memberCounts.set(row.workspace_id, (memberCounts.get(row.workspace_id) ?? 0) + 1);
    }

    const planIds = workspaceRows
      .flatMap((workspace) => workspace.workspace_subscriptions ?? [])
      .map((subscription) => subscription.plan_id)
      .filter((planId): planId is string => Boolean(planId));
    const uniquePlanIds = [...new Set(planIds)];
    const planById = new Map<string, BenefitPlanRow>();
    if (uniquePlanIds.length > 0) {
      const plansRes = await client
        .from("benefit_plan")
        .select("id, code, name, tier, billing_cycle")
        .in("id", uniquePlanIds);

      if (plansRes.error) {
        throw plansRes.error;
      }

      for (const plan of (plansRes.data ?? []) as BenefitPlanRow[]) {
        planById.set(plan.id, plan);
      }
    }

    const workspaces = workspaceRows
      .map((workspace) => {
        if (!workspace?.id || !workspace.name || workspace.status.trim().toUpperCase() !== "ACTIVE") {
          return null;
        }
        const role = workspace.workspace_members?.[0]?.role ?? "MEMBER";
        const subscription = workspace.workspace_subscriptions?.[0];
        const planState = resolveWorkspacePlanState(subscription, planById);
        return {
          id: workspace.id,
          name: workspace.name,
          logoUrl: workspace.logo_url,
          role,
          status: workspace.status,
          members: memberCounts.get(workspace.id) ?? 0,
          ...planState,
        } satisfies WorkspaceSummary;
      })
      .filter((item): item is WorkspaceSummary => Boolean(item));

    const activeWorkspaceId = workspaces.some((workspace) => workspace.id === config.workspaceId)
      ? config.workspaceId
      : (workspaces[0]?.id ?? "");

    return {
      workspaces,
      activeWorkspaceId,
    };
  })();

  pendingWorkspaceSummaryKey = configKey;
  pendingWorkspaceSummaryPromise = pendingRequest;

  try {
    const result = await pendingRequest;
    cachedWorkspaceSummaryKey = configKey;
    cachedWorkspaceSummaryResult = result;
    cachedWorkspaceSummaryExpiresAt = Date.now() + WORKSPACE_SUMMARY_CACHE_TTL_MS;
    return result;
  } finally {
    if (pendingWorkspaceSummaryPromise === pendingRequest) {
      pendingWorkspaceSummaryPromise = null;
      pendingWorkspaceSummaryKey = "";
    }
  }
}
