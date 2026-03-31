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
import { createPortal } from "react-dom";
import { CircleNotch } from "@phosphor-icons/react";
import GlobalLoading from "../components/ui/GlobalLoading";

type GlobalLoaderContextValue = {
  showLoader: (text?: string, durationMs?: number) => void;
  hideLoader: () => void;
  showGlobalLoading: (text?: string, key?: string, tone?: "loading" | "error", priority?: number) => void;
  hideGlobalLoading: (key?: string) => void;
};

type GlobalLoaderEntry = {
  key: string;
  text: string;
  tone: "loading" | "error";
  priority: number;
};

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const [bannerState, setBannerState] = useState({
    isVisible: false,
    text: "",
  });
  const [globalLoaders, setGlobalLoaders] = useState<GlobalLoaderEntry[]>([]);
  const timerRef = useRef<number | null>(null);

  const hideLoader = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBannerState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const showLoader = useCallback((text = "Loading...", durationMs = 3_000) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBannerState({ isVisible: true, text });
    if (durationMs > 0) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        hideLoader();
      }, durationMs);
    }
  }, [hideLoader]);

  const showGlobalLoading = useCallback((
    text = "Loading...",
    key = "default",
    tone: "loading" | "error" = "loading",
    priority = 0,
  ) => {
    setGlobalLoaders((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.key === key);
      if (existingIndex === -1) {
        return [...prev, { key, text, tone, priority }];
      }
      const next = [...prev];
      next[existingIndex] = { key, text, tone, priority };
      return next;
    });
  }, []);

  const hideGlobalLoading = useCallback((key = "default") => {
    setGlobalLoaders((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo<GlobalLoaderContextValue>(() => ({
    showLoader,
    hideLoader,
    showGlobalLoading,
    hideGlobalLoading,
  }), [hideGlobalLoading, hideLoader, showGlobalLoading, showLoader]);

  const activeGlobalLoader = useMemo(() => {
    if (globalLoaders.length === 0) {
      return null;
    }
    return globalLoaders.reduce((best, entry) => {
      if (!best) {
        return entry;
      }
      return entry.priority >= best.priority ? entry : best;
    }, null as GlobalLoaderEntry | null);
  }, [globalLoaders]);

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      <GlobalLoaderBanner isVisible={bannerState.isVisible} text={bannerState.text} />
      {activeGlobalLoader ? (
        <GlobalLoading
          text={activeGlobalLoader.text || "Loading..."}
          tone={activeGlobalLoader.tone || "loading"}
        />
      ) : null}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  const context = useContext(GlobalLoaderContext);
  if (!context) {
    throw new Error("useGlobalLoader must be used within GlobalLoaderProvider");
  }
  return context;
}

function GlobalLoaderBanner(props: { isVisible: boolean; text: string }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-[999999] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#1A162F] px-4 py-2.5 text-white shadow-xl transition-all duration-300 ${
        props.isVisible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-8 opacity-0 scale-95"
      }`}
    >
      <CircleNotch size={16} weight="bold" className="animate-spin" />
      <span className="text-sm font-medium tracking-wide">{props.text}</span>
    </div>,
    document.body,
  );
}
