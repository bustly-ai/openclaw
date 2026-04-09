import { useEffect, useRef, type ReactElement } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

// Types are defined in electron.d.ts
import BustlyLoginPage from "./components/Onboard/BustlyLoginPage";
import ChatPage from "./components/ChatPage/index";
import ClientAppShell from "./components/ClientAppShell";
import SkillPage from "./components/SkillPage";
import { AppStateProvider, useAppState } from "./providers/AppStateProvider";
import DeepLinkBridge from "./providers/DeepLinkBridge";
import { GlobalLoaderProvider, useGlobalLoader } from "./providers/GlobalLoaderProvider";

function AppShell() {
  const {
    loggedIn,
    checking,
    error,
    gatewayPhase,
    gatewayMessage,
    gatewayCanRestoreLastGoodConfig,
    gatewayReady,
    refreshAppState,
    restoreGatewayLastGoodConfig,
  } = useAppState();
  const { showGlobalLoading, hideGlobalLoading } = useGlobalLoader();
  const location = useLocation();
  const pathname = location.pathname || "/";
  const isBustlyLoginWindow = pathname === "/bustly-login";
  const hasCompletedInitialGatewayBootRef = useRef(false);

  useEffect(() => {
    if (!loggedIn || hasCompletedInitialGatewayBootRef.current) {
      return;
    }
    if (gatewayReady) {
      hasCompletedInitialGatewayBootRef.current = true;
    }
  }, [gatewayPhase, gatewayReady, loggedIn]);

  const showGatewayLoading =
    !isBustlyLoginWindow &&
    loggedIn &&
    !hasCompletedInitialGatewayBootRef.current &&
    gatewayPhase !== "error";
  const shouldShowGatewayRecovery =
    Boolean(error?.trim()) && gatewayCanRestoreLastGoodConfig;
  const appLoadingMessage = shouldShowGatewayRecovery
    ? "Bustly configuration is corrupted. Restore from backup?"
    : (error?.trim() || gatewayMessage?.trim() || "Loading...");
  const appLoadingTone = error?.trim() ? "error" : "loading";
  const appLoadingActions =
    shouldShowGatewayRecovery
      ? [
          {
            label: "Restore",
            onClick: () => {
              void restoreGatewayLastGoodConfig();
            },
          },
        ]
      : undefined;

  useEffect(() => {
    if (checking || showGatewayLoading || Boolean(error?.trim())) {
      showGlobalLoading(appLoadingMessage, "app-shell", appLoadingTone, 0, appLoadingActions);
      return;
    }
    hideGlobalLoading("app-shell");
  }, [
    appLoadingActions,
    appLoadingMessage,
    appLoadingTone,
    checking,
    error,
    hideGlobalLoading,
    showGatewayLoading,
    showGlobalLoading,
  ]);

  const renderLoginRoute = () => {
    if (checking) {
      return null;
    }
    if (loggedIn) {
      return <Navigate to="/chat" replace />;
    }
    return (
      <BustlyLoginPage
        onContinue={() => {
          void refreshAppState();
        }}
        autoContinue
        showSignOut={false}
        showContinueWhenLoggedIn={false}
      />
    );
  };

  const renderProtectedRoute = (element: ReactElement) => {
    if (checking) {
      return null;
    }
    if (!loggedIn) {
      return <Navigate to="/bustly-login" replace />;
    }
    return element;
  };

  const renderDefault = () => {
    if (checking) {
      return null;
    }
    if (!loggedIn) {
      return <Navigate to="/bustly-login" replace />;
    }
    return <Navigate to="/chat" replace />;
  };

  const isClientRoute = pathname === "/chat" || pathname === "/skill";
  const activeClientPage = pathname === "/skill" ? "skill" : "chat";

  if (isClientRoute) {
    return (
      <>
        <DeepLinkBridge />
        {renderProtectedRoute(
          <ClientAppShell
            activePage={activeClientPage}
            chatPage={<ChatPage />}
            skillPage={activeClientPage === "skill" ? <SkillPage /> : undefined}
          />,
        )}
      </>
    );
  }

  return (
    <>
      <DeepLinkBridge />
      <Routes>
        <Route
          path="/bustly-login"
          element={renderLoginRoute()}
        />
        <Route
          path="/provider-setup"
          element={<Navigate to="/chat" replace />}
        />
        <Route
          path="/devpanel"
          element={<Navigate to="/chat" replace />}
        />
        <Route path="/" element={renderDefault()} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function GatewayLoaderBridge() {
  const { gatewayPhase, loggedIn } = useAppState();
  const { showLoader, hideLoader } = useGlobalLoader();
  const hasCompletedInitialGatewayBootRef = useRef(false);

  useEffect(() => {
    if (!loggedIn) {
      hasCompletedInitialGatewayBootRef.current = false;
      hideLoader();
      return;
    }
    if (gatewayPhase === "ready") {
      hasCompletedInitialGatewayBootRef.current = true;
      hideLoader();
      return;
    }
    const shouldShow =
      hasCompletedInitialGatewayBootRef.current &&
      (gatewayPhase === "starting" || gatewayPhase === "checking");
    if (shouldShow) {
      showLoader("Loading...", 0);
      return;
    }
    hideLoader();
  }, [gatewayPhase, hideLoader, loggedIn, showLoader]);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <AppStateProvider>
        <GlobalLoaderProvider>
          <GatewayLoaderBridge />
          <AppShell />
        </GlobalLoaderProvider>
      </AppStateProvider>
    </HashRouter>
  );
}
