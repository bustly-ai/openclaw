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
import GlobalLoading from "./components/ui/GlobalLoading";

function AppShell() {
  const {
    loggedIn,
    checking,
    gatewayPhase,
    gatewayReady,
    refreshAppState,
  } = useAppState();
  const location = useLocation();
  const pathname = location.pathname || "/";
  const isBustlyLoginWindow = pathname === "/bustly-login";
  const hasCompletedInitialGatewayBootRef = useRef(false);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) {
      return;
    }
    const unsubscribe = window.electronAPI.onUpdateStatus(() => {});
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || hasCompletedInitialGatewayBootRef.current) {
      return;
    }
    if (gatewayReady) {
      hasCompletedInitialGatewayBootRef.current = true;
    }
  }, [gatewayPhase, gatewayReady, loggedIn]);

  const renderLoginRoute = () => {
    if (checking) {
      return <GlobalLoading />;
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
      return <GlobalLoading />;
    }
    if (!loggedIn) {
      return <Navigate to="/bustly-login" replace />;
    }
    return element;
  };

  const renderDefault = () => {
    if (checking) {
      return <GlobalLoading />;
    }
    if (!loggedIn) {
      return <Navigate to="/bustly-login" replace />;
    }
    return <Navigate to="/chat" replace />;
  };

  const showGatewayLoading =
    !isBustlyLoginWindow &&
    loggedIn &&
    !hasCompletedInitialGatewayBootRef.current &&
    gatewayPhase !== "error";
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
        <Route
          path="/chat"
          element={renderProtectedRoute(
            <ClientAppShell>
              <ChatPage />
            </ClientAppShell>
          )}
        />
        <Route
          path="/skill"
          element={renderProtectedRoute(
            <ClientAppShell>
              <SkillPage />
            </ClientAppShell>
          )}
        />
        <Route path="/" element={renderDefault()} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showGatewayLoading ? (
        <GlobalLoading />
      ) : null}
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
