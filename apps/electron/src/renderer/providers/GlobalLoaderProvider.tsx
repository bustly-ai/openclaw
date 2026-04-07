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
  showLoader: (text?: string, durationMs?: number, tone?: "loading" | "error") => void;
  hideLoader: () => void;
  showGlobalLoading: (
    text?: string,
    key?: string,
    tone?: "loading" | "error",
    priority?: number,
    actions?: GlobalLoaderAction[],
  ) => void;
  hideGlobalLoading: (key?: string) => void;
};

export type GlobalLoaderAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

type GlobalLoaderEntry = {
  key: string;
  text: string;
  tone: "loading" | "error";
  priority: number;
  actions?: GlobalLoaderAction[];
};

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const [bannerState, setBannerState] = useState({
    isVisible: false,
    text: "",
    tone: "loading" as "loading" | "error",
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

  const showLoader = useCallback((
    text = "Loading...",
    durationMs = 3_000,
    tone: "loading" | "error" = "loading",
  ) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBannerState({ isVisible: true, text, tone });
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
    actions?: GlobalLoaderAction[],
  ) => {
    setGlobalLoaders((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.key === key);
      if (existingIndex === -1) {
        return [...prev, { key, text, tone, priority, actions }];
      }
      const next = [...prev];
      next[existingIndex] = { key, text, tone, priority, actions };
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
      <GlobalLoaderBanner
        isVisible={bannerState.isVisible}
        text={bannerState.text}
        tone={bannerState.tone}
      />
      {activeGlobalLoader ? (
        <GlobalLoading
          text={activeGlobalLoader.text || "Loading..."}
          tone={activeGlobalLoader.tone || "loading"}
          actions={activeGlobalLoader.actions}
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

function GlobalLoaderBanner(props: {
  isVisible: boolean;
  text: string;
  tone: "loading" | "error";
}) {
  if (typeof document === "undefined") {
    return null;
  }

  const isError = props.tone === "error";
  return createPortal(
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-[999999] flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2.5 shadow-xl transition-all duration-300 ${
        isError ? "bg-[#FDECEC] text-[#C93030]" : "bg-[#1A162F] text-white"
      } ${
        props.isVisible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-8 opacity-0 scale-95"
      }`}
    >
      <CircleNotch
        size={16}
        weight="bold"
        className={isError ? "" : "animate-spin"}
      />
      <span className="text-sm font-medium tracking-wide">{props.text}</span>
    </div>,
    document.body,
  );
}
