import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: string;
  status: string;
  created_at: string;
  workspaces:
    | {
        id: string;
        name: string;
        logo_url: string | null;
        status: string;
      }
    | {
        id: string;
        name: string;
        logo_url: string | null;
        status: string;
      }[]
    | null;
};

type WorkspaceMemberCountRow = {
  workspace_id: string;
};

type WorkspaceSubscriptionRow = {
  workspace_id: string;
  status: string;
  current_period_end: string | null;
  end_at: string | null;
  updated_at: string;
  benefit_plan:
    | {
        code: string | null;
        name: string | null;
        tier: string | null;
      }
    | {
        code: string | null;
        name: string | null;
        tier: string | null;
      }[]
    | null;
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

function resolvePlanLabel(subscription?: WorkspaceSubscriptionRow): string | null {
  const benefitPlan = Array.isArray(subscription?.benefit_plan)
    ? subscription.benefit_plan[0]
    : subscription?.benefit_plan;
  return (
    benefitPlan?.name?.trim() ||
    benefitPlan?.tier?.trim() ||
    benefitPlan?.code?.trim() ||
    null
  );
}

function resolveWorkspacePlanState(subscription?: WorkspaceSubscriptionRow): Pick<
  WorkspaceSummary,
  "plan" | "expired" | "planDisplayText" | "badge" | "expirationText" | "buttonText" | "planStatus"
> {
  const now = Date.now();
  const status = subscription?.status?.trim().toLowerCase() ?? "";
  const effectiveEndAt = subscription?.end_at || subscription?.current_period_end;
  const endAt = parseTimestamp(effectiveEndAt);
  const currentPeriodEnd = parseTimestamp(subscription?.current_period_end);
  const isExpired = Boolean((endAt ?? currentPeriodEnd) !== null && (endAt ?? currentPeriodEnd)! <= now) || status === "expired";
  const isCanceled = status === "pending_cancellation" || status === "canceled";
  const isTrial = status === "trialing" || status === "trial";
  const planLabel = resolvePlanLabel(subscription);
  const planDisplayText = planLabel || "Basic";

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
      expirationText: effectiveEndAt ? `Will renew on ${formatPlanDate(effectiveEndAt)}.` : "",
      buttonText: "Manage",
      planStatus: "active",
    };
  }

  if (isCanceled && endAt !== null) {
    const daysLeft = Math.max(0, Math.ceil((endAt - now) / (1000 * 60 * 60 * 24)));
    return {
      plan: planLabel,
      expired: false,
      planDisplayText,
      badge: "",
      expirationText: daysLeft < 7 ? `${daysLeft} days left.` : `Expires on ${formatPlanDate(effectiveEndAt)}.`,
      buttonText: "Renew",
      planStatus: "canceled",
    };
  }

  if (effectiveEndAt) {
    return {
      plan: planLabel,
      expired: false,
      planDisplayText,
      badge: "",
      expirationText: `Will renew on ${formatPlanDate(effectiveEndAt)}.`,
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
  const configKey = [
    config.url,
    config.anonKey,
    config.accessToken,
    config.userId,
    config.workspaceId,
  ].join("|");
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

export async function listWorkspaceSummaries(): Promise<{
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}> {
  const { client, config } = await getBustlySupabaseClient();
  const membershipRes = await client
    .from("workspace_members")
    .select("workspace_id, role, status, created_at, workspaces!inner(id, name, logo_url, status)")
    .eq("user_id", config.userId)
    .eq("status", "ACTIVE")
    .eq("workspaces.status", "ACTIVE")
    .order("created_at", { ascending: false });

  if (membershipRes.error) {
    throw membershipRes.error;
  }

  const memberships = (membershipRes.data ?? []) as unknown as WorkspaceMembershipRow[];
  const workspaceIds = memberships.map((item) => item.workspace_id).filter(Boolean);
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

  const subscriptionRes = await client
  .from("workspace_subscriptions")
  .select(`
    workspace_id,
    status,
    current_period_end,
    end_at,
    updated_at,
    benefit_plan:benefit_plan!workspace_subscriptions_plan_id_fkey(code, name, tier)
  `)
  .in("workspace_id", workspaceIds)
  .order("updated_at", { ascending: false });

  if (subscriptionRes.error) {
    throw subscriptionRes.error;
  }


  const latestSubscriptionByWorkspace = new Map<string, WorkspaceSubscriptionRow>();
  for (const row of (subscriptionRes.data ?? []) as unknown as WorkspaceSubscriptionRow[]) {
    if (!latestSubscriptionByWorkspace.has(row.workspace_id)) {
      latestSubscriptionByWorkspace.set(row.workspace_id, row);
    }
  }

  const workspaces = memberships
    .map((item) => {
      const workspace = Array.isArray(item.workspaces) ? item.workspaces[0] : item.workspaces;
      if (!workspace?.id || !workspace.name || workspace.status.trim().toUpperCase() !== "ACTIVE") {
        return null;
      }
      const subscription = latestSubscriptionByWorkspace.get(item.workspace_id);
      const planState = resolveWorkspacePlanState(subscription);
      return {
        id: workspace.id,
        name: workspace.name,
        logoUrl: workspace.logo_url,
        role: item.role,
        status: workspace.status,
        members: memberCounts.get(item.workspace_id) ?? 0,
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
}
