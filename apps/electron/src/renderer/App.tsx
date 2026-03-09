import { useEffect, useState, useCallback, useRef } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

// Types are defined in electron.d.ts
import BustlyLoginPage from "./components/Onboard/BustlyLoginPage";
import ProviderSetupPage from "./components/Onboard/ProviderSetupPage";
import DevPanel from "./components/DevPanel";
import ChatPage from "./components/ChatPage/index";
import ClientAppShell from "./components/ClientAppShell";
import SkillPage from "./components/SkillPage";

interface LogEntry {
  id: number;
  stream: "stdout" | "stderr";
  message: string;
  timestamp: Date;
}

function AppShell() {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialRoute, setInitialRoute] = useState<"/chat" | "/bustly-login" | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || "/";
  const logIdRef = useRef(0);
  const controlUiRequestedRef = useRef(false);
  const isDevPanelWindow = pathname === "/devpanel";
  const isBustlyLoginWindow = pathname === "/bustly-login";
  const isProviderSetupWindow = pathname === "/provider-setup";
  const isChatWindow = pathname === "/chat";

  const handleDeepLink = useCallback(
    (data: { url: string; route: string | null } | null) => {
      const route = data?.route;
      if (!route) {
        return;
      }
      if (route === "/") {
        void navigate("/", { replace: true });
        return;
      }
      void navigate(route, { replace: true });
    },
    [navigate],
  );

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!window.electronAPI) {
        console.warn("Electron API not available");
        setError("Electron API not available. Are you running in a browser?");
        return;
      }

      try {
        const [status, info, initialized, loggedIn] = await Promise.all([
          window.electronAPI.gatewayStatus(),
          window.electronAPI.getAppInfo(),
          window.electronAPI.openclawIsInitialized(),
          window.electronAPI.bustlyIsLoggedIn(),
        ]);
        setGatewayStatus(status);
        setAppInfo(info);
        if (!isDevPanelWindow && !isBustlyLoginWindow && !isProviderSetupWindow && !isChatWindow) {
          setInitialRoute(initialized && status.running ? "/chat" : "/bustly-login");
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void loadInitialData();
  }, [isBustlyLoginWindow, isChatWindow, isDevPanelWindow, isProviderSetupWindow]);

  useEffect(() => {
    if (!initialRoute || isDevPanelWindow || isBustlyLoginWindow || isProviderSetupWindow) {
      return;
    }
    if (controlUiRequestedRef.current) {
      return;
    }
    controlUiRequestedRef.current = true;
    void navigate(initialRoute, { replace: true });
  }, [initialRoute, isDevPanelWindow, isBustlyLoginWindow, isProviderSetupWindow, navigate]);

  useEffect(() => {
    if (isDevPanelWindow || isBustlyLoginWindow || isProviderSetupWindow) {
      return;
    }
    if (!gatewayStatus?.running) {
      controlUiRequestedRef.current = false;
      return;
    }
    if (controlUiRequestedRef.current) {
      return;
    }
    controlUiRequestedRef.current = true;
    void navigate("/chat", { replace: true });
  }, [
    gatewayStatus?.running,
    isDevPanelWindow,
    isBustlyLoginWindow,
    isProviderSetupWindow,
    navigate,
  ]);

  // Refresh gateway status periodically (handles auto-start and external changes)
  useEffect(() => {
    if (!window.electronAPI) {return;}
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await window.electronAPI.gatewayStatus();
        if (!cancelled) {
          setGatewayStatus(status);
        }
      } catch {}
    };
    void tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Setup gateway log listeners
  useEffect(() => {
    if (!window.electronAPI) {return;}

    const unsubscribe = window.electronAPI.onGatewayLog((data) => {
      setLogs((prev) => [
        ...prev,
        {
          id: logIdRef.current++,
          stream: data.stream,
          message: data.message,
          timestamp: new Date(),
        },
      ]);
      // Keep only last 1000 logs
      setLogs((prev) => prev.slice(-1000));
    });

    const unsubscribeExit = window.electronAPI.onGatewayExit((data) => {
      setLogs((prev) => [
        ...prev,
        {
          id: logIdRef.current++,
          stream: "stderr",
          message: `Gateway exited: code=${data.code}, signal=${data.signal}`,
          timestamp: new Date(),
        },
      ]);
      setGatewayStatus((prev) => (prev ? { ...prev, running: false, pid: null } : null));
    });

    const unsubscribeMain = window.electronAPI.onMainLog((data) => {
      setLogs((prev) => [
        ...prev,
        {
          id: logIdRef.current++,
          stream: "stderr",
          message: `[main] ${data.message}`,
          timestamp: new Date(),
        },
      ]);
      setLogs((prev) => prev.slice(-1000));
    });

    return () => {
      unsubscribe();
      unsubscribeExit();
      unsubscribeMain();
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) {
      return;
    }
    const unsubscribe = window.electronAPI.onUpdateStatus((data) => {
      if (data.event === "available" || data.event === "download-progress") {
        setUpdateMessage("A new version was found. Updating now...");
      } else if (data.event === "downloaded") {
        setUpdateMessage("Find new version available.");
      } else if (data.event === "error") {
        setUpdateMessage(null);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }
    void window.electronAPI.consumePendingDeepLink().then((data) => {
      handleDeepLink(data);
    });
    const unsubscribe = window.electronAPI.onDeepLink((data) => {
      handleDeepLink(data);
    });
    return () => {
      unsubscribe();
    };
  }, [handleDeepLink]);

  // Gateway control handlers
  const handleStartGateway = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setError(null);
    const result = await window.electronAPI.gatewayStart();
    if (!result.success) {
      setError(result.error ?? "Failed to start gateway");
      return;
    }
    // Refresh status
    const status = await window.electronAPI.gatewayStatus();
    setGatewayStatus(status);
  }, []);

  const handleStopGateway = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setError(null);
    const result = await window.electronAPI.gatewayStop();
    if (!result.success) {
      setError(result.error ?? "Failed to stop gateway");
      return;
    }
    // Refresh status
    const status = await window.electronAPI.gatewayStatus();
    setGatewayStatus(status);
  }, []);

  // Open Control UI in browser
  const handleOpenControlUI = useCallback(async () => {
    if (!gatewayStatus?.running) {
      setError("Gateway is not running");
      return;
    }
    setError("Control UI opens automatically in the desktop window.");
  }, [gatewayStatus]);

  // Clear logs
  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleReOnboard = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setError(null);
    const result = await window.electronAPI.openclawReset();
    if (!result.success) {
      setError(result.error ?? "Failed to reset onboarding");
      return;
    }
    controlUiRequestedRef.current = false;
    setInitialRoute("/bustly-login");
    void navigate("/bustly-login", { replace: true });
  }, []);

  const renderDefault = () => {
    if (!initialRoute) {
      return (
        <div className="onboard-loading">
          <div className="onboard-loading-card">
            <div className="onboard-loading-spinner" />
            <p className="onboard-loading-title">Starting Bustly</p>
            <p className="onboard-loading-subtitle">
              Checking your local session. This should only take a moment...
            </p>
            {updateMessage ? (
              <p className="onboard-loading-update">{updateMessage}</p>
            ) : null}
          </div>
        </div>
      );
    }
    return <Navigate to={initialRoute} replace />;
  };

  return (
    <Routes>
      <Route
        path="/devpanel"
        element={
          <DevPanel
            appInfo={appInfo}
            gatewayStatus={gatewayStatus}
            logs={logs}
            error={error}
            onStartGateway={handleStartGateway}
            onStopGateway={handleStopGateway}
            onReOnboard={handleReOnboard}
            onOpenControlUI={handleOpenControlUI}
            onClearLogs={handleClearLogs}
          />
        }
      />
      <Route
        path="/bustly-login"
        element={
          <BustlyLoginPage
            onContinue={() => {
              void navigate("/chat", { replace: true });
            }}
            autoContinue
            showSignOut={false}
            showContinueWhenLoggedIn={false}
          />
        }
      />
      <Route
        path="/provider-setup"
        element={
          <ProviderSetupPage
            onDone={() => {
              void navigate("/chat", { replace: true });
            }}
          />
        }
      />
      <Route
        path="/chat"
        element={
          <ClientAppShell>
            <ChatPage />
          </ClientAppShell>
        }
      />
      <Route
        path="/skill"
        element={
          <ClientAppShell>
            <SkillPage />
          </ClientAppShell>
        }
      />
      <Route path="/" element={renderDefault()} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
