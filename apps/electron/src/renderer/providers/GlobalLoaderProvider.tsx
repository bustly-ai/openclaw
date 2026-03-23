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

type GlobalLoaderContextValue = {
  showLoader: (text?: string, durationMs?: number) => void;
  hideLoader: () => void;
};

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const [loaderState, setLoaderState] = useState({
    isVisible: false,
    text: "",
  });
  const timerRef = useRef<number | null>(null);

  const hideLoader = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLoaderState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const showLoader = useCallback((text = "Loading...", durationMs = 3_000) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLoaderState({ isVisible: true, text });
    if (durationMs > 0) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        hideLoader();
      }, durationMs);
    }
  }, [hideLoader]);

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
  }), [hideLoader, showLoader]);

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      <GlobalLoaderBanner isVisible={loaderState.isVisible} text={loaderState.text} />
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
