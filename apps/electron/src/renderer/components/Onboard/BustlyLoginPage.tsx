import { useCallback, useEffect, useRef, useState } from "react";
import OnboardContainer from "./OnboardContainer";
import bustlyLogo from "../../../../assets/imgs/collapsed_logo_v2.svg";

type BustlyLoginPageProps = {
  onContinue: () => void;
  autoContinue?: boolean;
  showContinueWhenLoggedIn?: boolean;
  showSignOut?: boolean;
  onLoggedOut?: () => void;
};

export default function BustlyLoginPage({
  onContinue,
  autoContinue = false,
  showContinueWhenLoggedIn = true,
  showSignOut = true,
  onLoggedOut,
}: BustlyLoginPageProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoContinueFiredRef = useRef(false);

  const waitForGatewayReady = useCallback(async () => {
    if (!window.electronAPI?.gatewayStatus || !window.electronAPI.gatewayConnectConfig) {
      throw new Error("Electron gateway APIs are unavailable");
    }

    const deadline = Date.now() + 30_000;
    let lastError = "Gateway did not become reachable";

    while (Date.now() < deadline) {
      const status = await window.electronAPI.gatewayStatus();
      if (status.running) {
        try {
          const connectConfig = await window.electronAPI.gatewayConnectConfig();
          if (connectConfig.wsUrl) {
            await new Promise<void>((resolve, reject) => {
              const socket = new WebSocket(connectConfig.wsUrl);
              const timeout = window.setTimeout(() => {
                socket.close();
                reject(new Error("Timed out while opening gateway WebSocket"));
              }, 3_000);
              const cleanup = () => {
                window.clearTimeout(timeout);
              };

              socket.addEventListener("open", () => {
                cleanup();
                socket.close();
                resolve();
              });

              socket.addEventListener("error", () => {
                cleanup();
                reject(new Error("Gateway WebSocket connection failed"));
              });
            });
            return;
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      } else {
        lastError = "Gateway is still starting";
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    throw new Error(lastError);
  }, []);

  const continueWhenReady = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await waitForGatewayReady();
      onContinue();
    } catch (err) {
      autoContinueFiredRef.current = false;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onContinue, waitForGatewayReady]);

  const checkLoginStatus = useCallback(async () => {
    if (!window.electronAPI?.bustlyIsLoggedIn) {return;}

    try {
      setCheckingLogin(true);
      const loggedIn = await window.electronAPI.bustlyIsLoggedIn();
      setIsLoggedIn(loggedIn);
    } catch (err) {
      console.error("Failed to check login status:", err);
      setIsLoggedIn(false);
    } finally {
      setCheckingLogin(false);
    }
  }, []);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  useEffect(() => {
    if (!autoContinue || !isLoggedIn || checkingLogin) {
      return;
    }
    if (autoContinueFiredRef.current) {
      return;
    }
    autoContinueFiredRef.current = true;
    void continueWhenReady();
  }, [autoContinue, checkingLogin, continueWhenReady, isLoggedIn]);

  useEffect(() => {
    if (!window.electronAPI?.onBustlyLoginRefresh) {return;}
    const unsubscribe = window.electronAPI.onBustlyLoginRefresh(() => {
      void checkLoginStatus();
    });
    return () => {
      unsubscribe?.();
    };
  }, [checkLoginStatus]);

  const handleBustlyLogin = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.bustlyLogin();
      if (result.success) {
        await checkLoginStatus();
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [checkLoginStatus]);

  const handleBustlyLogout = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.bustlyLogout();
      if (result.success) {
        setIsLoggedIn(false);
        onLoggedOut?.();
      } else {
        setError(result.error || "Logout failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onLoggedOut]);

  return (
    <OnboardContainer className="w-full max-w-md mx-auto px-6 text-center pt-10">
      <div className="mb-10">
        <img src={bustlyLogo} alt="Bustly AI" className="h-20 mx-auto mb-2" />
        <h1 className="text-4xl font-bold text-[#1A162F] mb-2">Bustly AI</h1>
        <p className="text-lg text-[#6C6F86]">The 24/7 Operator for Your Business</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-600 text-left">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="space-y-4">
        {!isLoggedIn || showContinueWhenLoggedIn ? (
          <button
            onClick={isLoggedIn ? () => void continueWhenReady() : handleBustlyLogin}
            disabled={loading || checkingLogin}
            className="w-full py-4 bg-[#1A162F] text-white font-bold rounded-xl hover:bg-[#1A162F]/90 disabled:opacity-80 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 text-lg"
          >
            {loading ? (
              <>
                <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span>{"Waiting"}</span>
              </>
            ) : isLoggedIn ? (
              "Continue"
            ) : (
              "Sign in or Sign up"
            )}
          </button>
        ) : null}

        {showSignOut && isLoggedIn && (
          <button
            onClick={handleBustlyLogout}
            disabled={loading || checkingLogin}
            className="w-full py-4 bg-white border border-gray-200 text-[#1A162F] font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center justify-center gap-2 text-lg"
          >
            Sign out
          </button>
        )}
      </div>
    </OnboardContainer>
  );
}
