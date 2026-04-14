import { GatewayBrowserClient, type GatewayEventFrame } from "./gateway-client";
import { createGatewayInstanceId } from "./gateway-instance-id";
import { getRendererHostAdapter } from "../platform/host";

type GatewayMethodRequest = {
  method: string;
  payload?: unknown;
  scope?: string;
};

type GatewayEventListener = (event: GatewayEventFrame) => void;

export type BustlySessionLabelUpdatedPayload = {
  agentId: string;
  sessionKey: string;
  label: string;
  updatedAt: number | null;
};

type BustlyLoginStartResult = {
  loginUrl: string;
  loginTraceId: string;
};

let sharedEventClient: GatewayBrowserClient | null = null;
let sharedEventClientStarting = false;
const sharedEventListeners = new Set<GatewayEventListener>();

async function ensureGatewayConnectConfig(): Promise<GatewayConnectConfig> {
  const host = getRendererHostAdapter();
  const gatewayStatus = await host.gatewayStatus();
  if (!gatewayStatus.running) {
    const startResult = await host.gatewayStart();
    if (!startResult.success) {
      throw new Error(startResult.error ?? "Gateway is not running.");
    }
  }

  const connection = await host.gatewayConnectConfig();
  if (!connection.token || !connection.wsUrl) {
    throw new Error("Gateway token missing in config; cannot connect.");
  }
  return connection;
}

export async function initializeBustlyGatewayIfNeeded(): Promise<void> {
  const host = getRendererHostAdapter();
  const gatewayStatus = await host.gatewayStatus();
  if (gatewayStatus.initialized) {
    return;
  }
  const result = await host.openclawInit();
  if (!result.success) {
    throw new Error(result.error ?? "Failed to initialize OpenClaw.");
  }
}

export async function requestBustlyGatewayMethod<T>(params: GatewayMethodRequest): Promise<T> {
  const connection = await ensureGatewayConnectConfig();

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const client = new GatewayBrowserClient({
      url: connection.wsUrl,
      token: connection.token ?? undefined,
      clientName: "openclaw-control-ui",
      mode: "ui",
      instanceId: createGatewayInstanceId(params.scope ?? "bustly"),
      onHello: () => {
        void client
          .request<T>(params.method, params.payload)
          .then((payload) => {
            if (settled) {
              return;
            }
            settled = true;
            client.stop();
            resolve(payload);
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

async function startSharedEventClient(): Promise<void> {
  if (sharedEventClient || sharedEventClientStarting || sharedEventListeners.size === 0) {
    return;
  }
  sharedEventClientStarting = true;
  try {
    const connection = await ensureGatewayConnectConfig();
    if (sharedEventListeners.size === 0) {
      return;
    }
    const client = new GatewayBrowserClient({
      url: connection.wsUrl,
      token: connection.token ?? undefined,
      clientName: "openclaw-control-ui",
      mode: "ui",
      instanceId: createGatewayInstanceId("bustly-events"),
      resolveConnection: async () => {
        const next = await ensureGatewayConnectConfig();
        return {
          url: next.wsUrl,
          token: next.token ?? undefined,
        };
      },
      onEvent: (event) => {
        for (const listener of [...sharedEventListeners]) {
          try {
            listener(event);
          } catch (error) {
            console.warn("[bustly-gateway] event listener failed", error);
          }
        }
      },
      onClose: () => {
        if (sharedEventListeners.size === 0) {
          sharedEventClient = null;
        }
      },
    });
    sharedEventClient = client;
    client.start();
  } finally {
    sharedEventClientStarting = false;
  }
}

function stopSharedEventClientIfIdle(): void {
  if (sharedEventListeners.size > 0) {
    return;
  }
  sharedEventClient?.stop();
  sharedEventClient = null;
}

function subscribeBustlyGatewayEvent<T>(
  eventName: string,
  listener: (payload: T) => void,
): () => void {
  const wrappedListener: GatewayEventListener = (event) => {
    if (event.event !== eventName) {
      return;
    }
    listener((event.payload ?? null) as T);
  };
  sharedEventListeners.add(wrappedListener);
  void startSharedEventClient().catch((error) => {
    console.warn("[bustly-gateway] failed to start shared event client", error);
  });
  return () => {
    sharedEventListeners.delete(wrappedListener);
    stopSharedEventClientIfIdle();
  };
}

export function subscribeBustlySessionLabelUpdated(
  listener: (payload: BustlySessionLabelUpdatedPayload) => void,
): () => void {
  return subscribeBustlyGatewayEvent<BustlySessionLabelUpdatedPayload>(
    "bustly.session.label.updated",
    listener,
  );
}

export async function getBustlySupabaseConfig(): Promise<BustlySupabaseConfig | null> {
  return await requestBustlyGatewayMethod<BustlySupabaseConfig | null>({
    method: "bustly.supabase.get-config",
    scope: "bustly-supabase",
  });
}

export async function isBustlyLoggedIn(): Promise<boolean> {
  const result = await getRendererHostAdapter().bustlyIsLoggedIn();
  if (!result.success) {
    throw new Error(result.error || "Failed to check Bustly login status.");
  }
  return result.loggedIn === true;
}

export async function startBustlyLogin(): Promise<BustlyLoginStartResult> {
  const result = await getRendererHostAdapter().bustlyLogin();
  if (!result.success || !result.loginTraceId) {
    throw new Error(result.error || "Failed to start Bustly login.");
  }
  return {
    loginTraceId: result.loginTraceId,
    loginUrl: "",
  };
}

export async function pollBustlyLogin(loginTraceId: string): Promise<{ pending: boolean }> {
  const result = await getRendererHostAdapter().bustlyPollLogin(loginTraceId);
  if (!result.success) {
    throw new Error(result.error || "Failed to poll Bustly login.");
  }
  return { pending: result.pending };
}

export async function cancelBustlyLogin(loginTraceId?: string): Promise<void> {
  const result = await getRendererHostAdapter().bustlyCancelLogin(loginTraceId);
  if (!result.success) {
    throw new Error(result.error || "Failed to cancel Bustly login.");
  }
}

export async function getBustlyUserInfo(): Promise<BustlyUserInfo | null> {
  const result = await getRendererHostAdapter().bustlyGetUserInfo();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Bustly user info.");
  }
  return result.user ?? null;
}

export async function getActiveBustlyWorkspace(): Promise<{
  workspaceId: string;
  agentId: string;
  workspaceDir: string;
}> {
  return await requestBustlyGatewayMethod({
    method: "bustly.workspace.get-active",
    scope: "bustly-workspace",
  });
}

export async function bootstrapBustlyRuntime(params?: {
  workspaceId?: string;
  workspaceName?: string;
  agentName?: string;
  selectedModel?: string;
}): Promise<{
  workspaceId: string;
  agentId: string;
  workspaceDir: string;
  presetAgentsApplied: number;
}> {
  return await requestBustlyGatewayMethod({
    method: "bustly.runtime.bootstrap",
    payload: params ?? {},
    scope: "bustly-runtime",
  });
}

export async function setActiveBustlyWorkspace(params: {
  workspaceId: string;
  workspaceName?: string;
}): Promise<{
  workspaceId: string;
  agentId: string;
  workspaceDir: string;
}> {
  return await requestBustlyGatewayMethod({
    method: "bustly.workspace.set-active",
    payload: params,
    scope: "bustly-workspace",
  });
}

export async function listBustlyAgents(workspaceId?: string): Promise<BustlyWorkspaceAgent[]> {
  return await requestBustlyGatewayMethod({
    method: "bustly.agents.list",
    payload: workspaceId ? { workspaceId } : {},
    scope: "bustly-agents",
  });
}

export async function createBustlyAgent(params: {
  workspaceId: string;
  name: string;
  description?: string;
  icon?: string;
  workspaceName?: string;
  skills?: string[] | null;
}): Promise<{
  workspaceId: string;
  agentId: string;
  workspaceDir: string;
}> {
  return await requestBustlyGatewayMethod({
    method: "bustly.agents.create",
    payload: params,
    scope: "bustly-agents",
  });
}

export async function updateBustlyAgent(params: {
  workspaceId: string;
  agentId: string;
  name?: string;
  identityMarkdown?: string;
  icon?: string;
  skills?: string[] | null;
}): Promise<{ ok: true; workspaceId: string; agentId: string }> {
  return await requestBustlyGatewayMethod({
    method: "bustly.agents.update",
    payload: params,
    scope: "bustly-agents",
  });
}

export async function deleteBustlyAgent(params: {
  workspaceId: string;
  agentId: string;
}): Promise<{ ok: true; workspaceId: string; agentId: string }> {
  return await requestBustlyGatewayMethod({
    method: "bustly.agents.delete",
    payload: params,
    scope: "bustly-agents",
  });
}

export async function listBustlyAgentSessions(params: {
  workspaceId: string;
  agentId: string;
}): Promise<BustlyWorkspaceAgentSession[]> {
  return await requestBustlyGatewayMethod({
    method: "bustly.sessions.list",
    payload: params,
    scope: "bustly-sessions",
  });
}

export async function createBustlyAgentSession(params: {
  workspaceId: string;
  agentId: string;
  label?: string;
  promptExcerpt?: string;
  sampleRouteKey?: string;
}): Promise<{
  workspaceId: string;
  agentId: string;
  sessionKey: string;
  sessionId: string;
  name: string;
  updatedAt: number | null;
}> {
  return await requestBustlyGatewayMethod({
    method: "bustly.sessions.create",
    payload: params,
    scope: "bustly-sessions",
  });
}

export async function patchBustlySessionModel(params: {
  sessionKey: string;
  model: string;
}): Promise<string> {
  const result = await requestBustlyGatewayMethod<{
    ok: boolean;
    resolved?: { model?: string };
  }>({
    method: "sessions.patch",
    payload: {
      key: params.sessionKey,
      model: params.model,
    },
    scope: "bustly-sessions",
  });
  return result.resolved?.model?.trim() || params.model.trim();
}

export async function listGlobalSkillCatalog(): Promise<BustlyGlobalSkillCatalogItem[]> {
  return await requestBustlyGatewayMethod({
    method: "skills.catalog.list",
    scope: "skills-catalog",
  });
}

export async function installGlobalSkillCatalogItem(skillKey: string): Promise<void> {
  await requestBustlyGatewayMethod({
    method: "skills.catalog.install",
    payload: { skillKey },
    scope: `skills-catalog-install-${skillKey}`,
  });
}

export async function logoutBustly(): Promise<void> {
  const result = await getRendererHostAdapter().bustlyLogout();
  if (!result.success) {
    throw new Error(result.error || "Failed to sign out from Bustly.");
  }
}

export async function reportBustlyIssue(): Promise<{
  archivePath: string;
  stateDir: string;
  outputDir: string;
}> {
  return await requestBustlyGatewayMethod({
    method: "bustly.runtime.report-issue",
    scope: "bustly-runtime",
  });
}
