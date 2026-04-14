import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { bootstrapBustlyRuntime, isBustlyLoggedIn } from "../lib/bustly-gateway";
import { GatewayBrowserClient } from "../lib/gateway-client";
import { createGatewayInstanceId } from "../lib/gateway-instance-id";
import { getRendererHostAdapter } from "../platform/host";

type GatewayPhase = "idle" | "checking" | "starting" | "ready" | "error";

type AppStateContextValue = {
  appInfo: AppInfo | null;
  gatewayStatus: GatewayStatus | null;
  loggedIn: boolean;
  initialized: boolean;
  checking: boolean;
  gatewayPhase: GatewayPhase;
  gatewayReady: boolean;
  gatewayMessage: string | null;
  gatewayCanRestoreLastGoodConfig: boolean;
  error: string | null;
  refreshAppState: () => Promise<void>;
  ensureGatewayReady: () => Promise<boolean>;
  restoreGatewayLastGoodConfig: () => Promise<boolean>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

async function openGatewayProbe(wsUrl: string, token?: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const client = new GatewayBrowserClient({
      url: wsUrl,
      token,
      clientName: "openclaw-probe",
      mode: "probe",
      instanceId: createGatewayInstanceId("probe"),
      onHello: () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        client.stop();
        resolve();
      },
      onClose: ({ error }) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error(error?.message || "Gateway handshake failed"));
      },
    });
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      client.stop();
      reject(new Error("Timed out while connecting gateway session"));
    }, 3_000);
    client.start();
  });
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const host = useMemo(() => getRendererHostAdapter(), []);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [gatewayPhase, setGatewayPhase] = useState<GatewayPhase>("idle");
  const [gatewayMessage, setGatewayMessage] = useState<string | null>(null);
  const [gatewayCanRestoreLastGoodConfig, setGatewayCanRestoreLastGoodConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ensurePromiseRef = useRef<Promise<boolean> | null>(null);
  const ensureRunIdRef = useRef(0);
  const previousLoggedInRef = useRef(false);
  const runtimeBootstrapKeyRef = useRef<string | null>(null);

  const refreshAppState = useCallback(async () => {
    setChecking(true);
    try {
      const [status, info, nextInitialized] = await Promise.all([
        host.gatewayStatus(),
        host.getAppInfo(),
        host.openclawIsInitialized(),
      ]);
      const nextLoggedIn = nextInitialized ? await isBustlyLoggedIn().catch(() => false) : false;
      setGatewayStatus(status);
      setAppInfo(info);
      setInitialized(nextInitialized);
      setLoggedIn(nextLoggedIn);
      setError(null);
      setGatewayCanRestoreLastGoodConfig(false);
      if (!nextLoggedIn || !nextInitialized) {
        setGatewayPhase("idle");
        setGatewayMessage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, [host]);

  const ensureGatewayReady = useCallback(async () => {
    if (ensurePromiseRef.current) {
      return ensurePromiseRef.current;
    }
    const runId = ensureRunIdRef.current + 1;
    ensureRunIdRef.current = runId;
    const isStale = () => ensureRunIdRef.current !== runId;

    const task = (async () => {
      const deadline = Date.now() + 30_000;
      let lastError = "Gateway did not become reachable";
      let started = false;

      try {
        while (Date.now() < deadline) {
          if (isStale()) {
            return false;
          }
          const status = await host.gatewayStatus();
          if (isStale()) {
            return false;
          }
          setGatewayStatus(status);

          if (!status.running && !started) {
            started = true;
            if (isStale()) {
              return false;
            }
            setGatewayPhase("starting");
            setGatewayMessage("Starting gateway...");
            setGatewayCanRestoreLastGoodConfig(false);
            const startResult = await host.gatewayStart();
            if (!startResult.success) {
              lastError = startResult.error ?? "Failed to start gateway";
              break;
            }
          }

          if (status.running) {
            if (isStale()) {
              return false;
            }
            setGatewayPhase("checking");
            setGatewayMessage("Waiting for bustly...");
            setGatewayCanRestoreLastGoodConfig(false);
            try {
              const connectConfig = await host.gatewayConnectConfig();
              if (connectConfig.wsUrl) {
                await openGatewayProbe(connectConfig.wsUrl, connectConfig.token ?? undefined);
                if (isStale()) {
                  return false;
                }
                const runtimeBootstrapKey =
                  status.running && loggedIn && initialized
                    ? `${status.pid ?? 0}:logged-in`
                    : null;
                if (runtimeBootstrapKey && runtimeBootstrapKeyRef.current !== runtimeBootstrapKey) {
                  setGatewayPhase("checking");
                  setGatewayMessage("Preparing workspace...");
                  await bootstrapBustlyRuntime();
                  if (isStale()) {
                    return false;
                  }
                  runtimeBootstrapKeyRef.current = runtimeBootstrapKey;
                }
                setGatewayPhase("ready");
                setGatewayMessage(null);
                return true;
              }
            } catch (err) {
              if (runtimeBootstrapKeyRef.current && loggedIn && initialized) {
                runtimeBootstrapKeyRef.current = null;
              }
              lastError = err instanceof Error ? err.message : String(err);
            }
          } else {
            lastError = "Gateway is still starting";
          }

          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (isStale()) {
        return false;
      }
      setGatewayPhase("error");
      setGatewayMessage(null);
      setGatewayCanRestoreLastGoodConfig(false);
      setError(lastError);
      return false;
    })();

    ensurePromiseRef.current = task.finally(() => {
      ensurePromiseRef.current = null;
    });
    return ensurePromiseRef.current;
  }, [host, initialized, loggedIn]);

  const restoreGatewayLastGoodConfig = useCallback(async () => {
    ensureRunIdRef.current += 1;
    setGatewayPhase("starting");
    setGatewayMessage("Restoring last working gateway config...");
    setGatewayCanRestoreLastGoodConfig(false);
    setError(null);
    const result = await host.gatewayRestoreLastGoodConfig();
    if (!result.success) {
      setGatewayPhase("error");
      setGatewayMessage(null);
      setError(result.error ?? "Failed to restore last working gateway config");
      return false;
    }
    return await ensureGatewayReady();
  }, [ensureGatewayReady, host]);

  useEffect(() => {
    void refreshAppState();
  }, [refreshAppState]);

  useEffect(() => {
    if (!host.onGatewayLifecycle) {
      return;
    }
    const unsubscribe = host.onGatewayLifecycle((data) => {
      if (data.phase === "starting") {
        setGatewayPhase("starting");
        setGatewayMessage(data.message ?? "Starting gateway...");
        setGatewayCanRestoreLastGoodConfig(false);
        setError(null);
        return;
      }
      if (data.phase === "stopping") {
        setGatewayPhase("starting");
        setGatewayMessage(data.message ?? "Restarting gateway...");
        setGatewayCanRestoreLastGoodConfig(false);
        setError(null);
        return;
      }
      if (data.phase === "ready") {
        setGatewayPhase("checking");
        setGatewayMessage("Waiting for bustly...");
        setGatewayCanRestoreLastGoodConfig(false);
        setError(null);
        void ensureGatewayReady().then(() => {
          void refreshAppState();
        });
        return;
      }
      ensureRunIdRef.current += 1;
      setGatewayPhase("error");
      setGatewayMessage(null);
      setGatewayCanRestoreLastGoodConfig(data.canRestoreLastGoodConfig === true);
      if (data.message) {
        setError(data.message);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [ensureGatewayReady, host, refreshAppState]);

  useEffect(() => {
    if (!host.onBustlyLoginRefresh) {
      return;
    }
    return host.onBustlyLoginRefresh(() => {
      void refreshAppState();
    });
  }, [host, refreshAppState]);

  useEffect(() => {
    const wasLoggedIn = previousLoggedInRef.current;
    previousLoggedInRef.current = loggedIn;
    if (!wasLoggedIn && loggedIn && initialized) {
      runtimeBootstrapKeyRef.current = null;
      setGatewayPhase("idle");
      setGatewayMessage(null);
    }
    if (wasLoggedIn && !loggedIn) {
      runtimeBootstrapKeyRef.current = null;
    }
  }, [initialized, loggedIn]);

  useEffect(() => {
    if (!loggedIn || !initialized) {
      runtimeBootstrapKeyRef.current = null;
    }
  }, [initialized, loggedIn]);

  useEffect(() => {
    if (checking || !loggedIn || !initialized) {
      return;
    }
    if (gatewayPhase !== "idle") {
      return;
    }
    void ensureGatewayReady();
  }, [checking, ensureGatewayReady, gatewayPhase, initialized, loggedIn]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await host.gatewayStatus();
        if (cancelled) {
          return;
        }
        setGatewayStatus(status);
        let nextLoggedIn = loggedIn;
        if (initialized) {
          nextLoggedIn = await isBustlyLoggedIn().catch(() => false);
          if (cancelled) {
            return;
          }
          setLoggedIn(nextLoggedIn);
          if (!nextLoggedIn) {
            setGatewayPhase("idle");
            setGatewayMessage(null);
          }
        } else if (loggedIn) {
          setLoggedIn(false);
          nextLoggedIn = false;
        }
        if (!nextLoggedIn || !initialized) {
          return;
        }
        if (!status.running && gatewayPhase === "ready") {
          setGatewayPhase("idle");
          void ensureGatewayReady();
        }
      } catch {}
    };
    void tick();
    const interval = window.setInterval(tick, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [ensureGatewayReady, gatewayPhase, host, initialized, loggedIn]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      appInfo,
      gatewayStatus,
      loggedIn,
      initialized,
      checking,
      gatewayPhase,
      gatewayReady: gatewayPhase === "ready",
      gatewayMessage,
      gatewayCanRestoreLastGoodConfig,
      error,
      refreshAppState,
      ensureGatewayReady,
      restoreGatewayLastGoodConfig,
    }),
    [
      appInfo,
      checking,
      ensureGatewayReady,
      error,
      gatewayMessage,
      gatewayPhase,
      gatewayStatus,
      gatewayCanRestoreLastGoodConfig,
      initialized,
      loggedIn,
      refreshAppState,
      restoreGatewayLastGoodConfig,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
