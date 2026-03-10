import { useCallback, useEffect, useRef, useState } from "react";
import OnboardContainer from "./OnboardContainer";
import bustlyLogo from "../../../../assets/imgs/collapsed_logo_v2.svg";
import { useAppState } from "../../providers/AppStateProvider";

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
  const { loggedIn, checking, gatewayPhase } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoContinueFiredRef = useRef(false);

  useEffect(() => {
    if (!autoContinue || !loggedIn || checking) {
      return;
    }
    if (autoContinueFiredRef.current) {
      return;
    }
    autoContinueFiredRef.current = true;
    onContinue();
  }, [autoContinue, checking, loggedIn, onContinue]);

  const handleBustlyLogin = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.bustlyLogin();
      if (result.success) {
        onContinue();
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onContinue]);

  const handleBustlyLogout = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.bustlyLogout();
      if (result.success) {
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
        {!loggedIn || showContinueWhenLoggedIn ? (
          <button
            onClick={loggedIn ? onContinue : handleBustlyLogin}
            disabled={loading || checking}
            className="w-full py-4 bg-[#1A162F] text-white font-bold rounded-xl hover:bg-[#1A162F]/90 disabled:opacity-80 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 text-lg"
          >
            {loading ? (
              <>
                <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span>{"Waiting"}</span>
              </>
            ) : loggedIn ? (
              "Continue"
            ) : (
              "Sign in or Sign up"
            )}
          </button>
        ) : null}

        {showSignOut && loggedIn && (
          <button
            onClick={handleBustlyLogout}
            disabled={loading || checking || gatewayPhase === "starting" || gatewayPhase === "checking"}
            className="w-full py-4 bg-white border border-gray-200 text-[#1A162F] font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center justify-center gap-2 text-lg"
          >
            Sign out
          </button>
        )}
      </div>
    </OnboardContainer>
  );
}
