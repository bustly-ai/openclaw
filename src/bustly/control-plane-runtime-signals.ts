import { resolveBustlyControlPlaneRuntimeIdentity } from "./control-plane-runtime.js";

type FetchLike = typeof fetch;

export type BustlyControlPlaneRuntimeSignalsHandle = {
  enabled: boolean;
  stop: () => void;
};

function normalizeBindAddress(bindHost: string): string {
  const trimmed = bindHost.trim();
  if (!trimmed || trimmed === "0.0.0.0" || trimmed === "::") {
    return "127.0.0.1";
  }
  return trimmed;
}

function resolveNetwork(params: { bindHost: string; port: number; env: NodeJS.ProcessEnv }) {
  const normalizedBind = normalizeBindAddress(params.bindHost);
  const hostId = params.env.BUSTLY_RUNTIME_HOST_ID?.trim() || "openclaw-cloud";
  const privateIp = params.env.BUSTLY_RUNTIME_PRIVATE_IP?.trim() || normalizedBind;
  const publicEndpoint =
    params.env.BUSTLY_RUNTIME_PUBLIC_ENDPOINT?.trim() || `http://${normalizedBind}:${params.port}`;

  return {
    hostId,
    privateIp,
    publicEndpoint,
    port: params.port,
  };
}

async function postRuntimeSignal(params: {
  path: "/runtime/register" | "/runtime/heartbeat" | "/runtime/health";
  body: Record<string, unknown>;
  env: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}) {
  const identity = resolveBustlyControlPlaneRuntimeIdentity(params.env);
  if (!identity) {
    return;
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl(`${identity.baseUrl}${params.path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId: identity.workspaceId,
      runtimeId: identity.runtimeId,
      runtimeToken: identity.runtimeToken,
      ...params.body,
    }),
  });

  if (!response.ok) {
    throw new Error(`control_plane_signal_failed:${params.path}:${response.status}`);
  }
}

export async function registerBustlyRuntimeWithControlPlane(params: {
  bindHost: string;
  port: number;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}) {
  const env = params.env ?? process.env;
  await postRuntimeSignal({
    path: "/runtime/register",
    env,
    fetchImpl: params.fetchImpl,
    body: resolveNetwork({
      bindHost: params.bindHost,
      port: params.port,
      env,
    }),
  });
}

export async function reportBustlyRuntimeHeartbeat(params?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}) {
  const env = params?.env ?? process.env;
  await postRuntimeSignal({
    path: "/runtime/heartbeat",
    env,
    fetchImpl: params?.fetchImpl,
    body: {},
  });
}

export async function reportBustlyRuntimeHealth(params?: {
  endpointReachable?: boolean;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}) {
  const env = params?.env ?? process.env;
  await postRuntimeSignal({
    path: "/runtime/health",
    env,
    fetchImpl: params?.fetchImpl,
    body: {
      endpointReachable: params?.endpointReachable ?? true,
    },
  });
}

export async function startBustlyControlPlaneRuntimeSignals(params: {
  bindHost: string;
  port: number;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  intervalMs?: number;
  onWarn?: (message: string) => void;
}): Promise<BustlyControlPlaneRuntimeSignalsHandle> {
  const env = params.env ?? process.env;
  if (!resolveBustlyControlPlaneRuntimeIdentity(env)) {
    return {
      enabled: false,
      stop: () => {},
    };
  }

  const warn = params.onWarn ?? (() => {});
  const runSignals = async () => {
    try {
      await reportBustlyRuntimeHeartbeat({
        env,
        fetchImpl: params.fetchImpl,
      });
      await reportBustlyRuntimeHealth({
        env,
        fetchImpl: params.fetchImpl,
        endpointReachable: true,
      });
    } catch (error) {
      warn(
        `control plane runtime signal failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  try {
    await registerBustlyRuntimeWithControlPlane({
      bindHost: params.bindHost,
      port: params.port,
      env,
      fetchImpl: params.fetchImpl,
    });
    await runSignals();
  } catch (error) {
    warn(
      `control plane runtime registration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const interval = setInterval(() => {
    void runSignals();
  }, params.intervalMs ?? 30_000);

  return {
    enabled: true,
    stop: () => clearInterval(interval),
  };
}
