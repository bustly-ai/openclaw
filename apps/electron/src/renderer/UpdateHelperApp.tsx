import { useEffect, useState } from "react";

const emptyState: DesktopUpdateState = {
  sessionId: null,
  stage: "idle",
  currentVersion: "",
  targetVersion: null,
  ready: false,
  helperActive: false,
  progressPercent: null,
  transferred: null,
  total: null,
  bytesPerSecond: null,
  message: "Preparing update...",
  error: null,
  updatedAt: 0,
};

export default function UpdateHelperApp() {
  const [state, setState] = useState<DesktopUpdateState>(emptyState);

  useEffect(() => {
    let mounted = true;
    const statusPromise = window.electronAPI?.updaterStatus?.();
    if (statusPromise) {
      void statusPromise.then((status) => {
        if (!mounted) {
          return;
        }
        setState(status.state ?? emptyState);
      });
    }
    const unsubscribe = window.electronAPI?.onUpdateStatus?.((payload) => {
      if (payload.state) {
        setState(payload.state);
      }
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const isError = state.stage === "error";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF8F2] px-4 py-4 text-[#1A162F]">
      <div className="w-full max-w-[372px] rounded-[20px] border border-[#E5DCCF] bg-white px-6 py-5 shadow-[0_16px_44px_rgba(26,22,47,0.10)]">
        <p className="text-[20px] font-semibold leading-tight">
          {isError ? "Install failed" : "Installing update..."}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#666F8D]">
          {isError ? (state.error ?? "The updater could not finish this release.") : "Please keep Bustly closed. It will reopen automatically."}
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#ECE4D6]">
          {isError ? (
            <div className="h-full w-full rounded-full bg-[#C24A3A]" />
          ) : (
            <div className="h-full w-1/3 rounded-full bg-[#1A162F] animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
