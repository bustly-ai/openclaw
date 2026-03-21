import {
  FileText,
  MagnifyingGlass,
  ShoppingBag,
  SignOut,
  Sparkle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import OnboardContainer from "./OnboardContainer";
import bustlyWordmark from "../../assets/imgs/bustly_wordmark.png";
import { useAppState } from "../../providers/AppStateProvider";

type BustlyLoginPageProps = {
  onContinue: () => void;
  autoContinue?: boolean;
  showContinueWhenLoggedIn?: boolean;
  showSignOut?: boolean;
  onLoggedOut?: () => void;
};

const HOME_CAROUSEL_ITEMS = [
  {
    id: "shopify-orders",
    text: "Fix failed orders in Shopify.",
    icon: ShoppingBag,
  },
  {
    id: "attention",
    text: "Show me what needs attention today.",
    icon: Sparkle,
  },
  {
    id: "sales-diagnosis",
    text: "Explain why sales are down this week.",
    icon: MagnifyingGlass,
  },
  {
    id: "conversion",
    text: "Find products losing conversion.",
    icon: FileText,
  },
  {
    id: "customers",
    text: "Identify my highest-value customers.",
    icon: Sparkle,
  },
  {
    id: "reengagement",
    text: "Create a re-engagement campaign draft.",
    icon: FileText,
  },
  {
    id: "growth-actions",
    text: "Recommend 3 actions to grow this store.",
    icon: Sparkle,
  },
  {
    id: "revenue-summary",
    text: "Summarize today’s revenue and orders.",
    icon: FileText,
  },
  {
    id: "traffic-drops",
    text: "Spot unusual traffic drops.",
    icon: MagnifyingGlass,
  },
  {
    id: "win-back",
    text: "Flag customers I should win back.",
    icon: ShoppingBag,
  },
] as const;

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
  const [activeIndex, setActiveIndex] = useState(0);
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HOME_CAROUSEL_ITEMS.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  const handleBustlyLogin = useCallback(async () => {
    if (!window.electronAPI) {return;}
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.bustlyLogin();
      if (result.success) {
        onContinue();
      } else if (result.canceled) {
        setError(null);
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
    <OnboardContainer className="h-full w-full max-w-none px-0 py-0">
      <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-hidden bg-[#FFFEFC] px-6 py-16 [-webkit-app-region:drag]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,113,133,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(167,139,250,0.18),_transparent_30%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[620px] w-[620px] translate-x-[38%] -translate-y-[38%] rounded-full bg-rose-200/70 blur-3xl" />
        <div className="pointer-events-none absolute right-20 top-20 h-[360px] w-[360px] rounded-full bg-orange-100/70 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[620px] w-[620px] -translate-x-[38%] translate-y-[38%] rounded-full bg-violet-200/70 blur-3xl" />
        <div className="pointer-events-none absolute bottom-24 left-20 h-[340px] w-[340px] rounded-full bg-fuchsia-100/70 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-xl text-center [-webkit-app-region:no-drag]">
          <div className="mb-8">
            <img src={bustlyWordmark} alt="Bustly" className="mx-auto mb-5 h-10 w-auto" />
            <h1 className="mb-3 text-[26px] font-medium text-[#1A162F]">
              The 24/7 Operator for Your Business.
            </h1>
            <p className="text-[15px] text-[#666F8D]">
              Stop working in your business. Start working on it again.
            </p>
          </div>

          {error && (
            <div className="mx-auto mb-6 max-w-sm rounded-2xl border border-red-500/20 bg-red-50/90 px-4 py-3 text-left text-sm text-red-700 shadow-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="mx-auto mb-16 flex max-w-xs flex-col gap-3">
            {!loggedIn || showContinueWhenLoggedIn ? (
              <button
                onClick={loggedIn ? onContinue : handleBustlyLogin}
                disabled={checking}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A162F] px-4 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#1A162F]/90 hover:shadow-xl disabled:opacity-80"
              >
                {loggedIn ? (
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EF] bg-white px-4 py-3.5 text-base font-bold text-[#1A162F] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#FAFAFC] hover:shadow-md disabled:opacity-50"
              >
                <SignOut size={18} weight="bold" />
                <span>Sign out</span>
              </button>
            )}
          </div>

          <div className="relative mx-auto h-16 w-full max-w-[520px]">
            {HOME_CAROUSEL_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === activeIndex;

              return (
                <div
                  key={item.id}
                  className="absolute inset-x-0 top-0 transition-all duration-500 ease-out"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0px)" : "translateY(8px)",
                    pointerEvents: "none",
                  }}
                  aria-hidden={!isActive}
                >
                  <div className="mx-auto flex h-14 w-full items-center gap-3 overflow-hidden rounded-xl border border-gray-100 bg-white/90 px-5 py-3 text-[12px] text-gray-700 shadow-lg backdrop-blur-md">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <Icon size={16} weight="bold" className="text-[#1A162F]" />
                    </div>
                    <span className="flex-1 whitespace-nowrap text-left font-medium">{item.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </OnboardContainer>
  );
}
