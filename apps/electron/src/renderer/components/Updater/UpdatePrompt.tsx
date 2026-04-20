import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowsInSimple, ArrowClockwise, CheckCircle, DownloadSimple, WarningCircle } from "@phosphor-icons/react";

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
  message: null,
  error: null,
  updatedAt: 0,
};

export default function UpdatePrompt() {
  const [state, setState] = useState<DesktopUpdateState>(emptyState);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (state.targetVersion && state.targetVersion !== dismissedVersion) {
      return;
    }
    if (state.stage !== "available") {
      setDismissedVersion(null);
    }
  }, [dismissedVersion, state.stage, state.targetVersion]);

  useEffect(() => {
    if (
      state.stage === "idle" ||
      state.stage === "checking" ||
      state.stage === "not-available" ||
      state.stage === "restarted"
    ) {
      setIsModalOpen(false);
      setIsMinimized(false);
    }
  }, [state.stage]);

  const isError = state.stage === "error";
  const isAvailable = state.stage === "available";
  const isDownloaded = state.stage === "downloaded";
  const isPreparing = state.stage === "preparing";
  const isInstalling = state.stage === "installing";
  const isDownloading =
    state.stage === "launching-helper" ||
    state.stage === "downloading" ||
    state.stage === "preparing";
  const showAvailableEntry =
    isAvailable &&
    (!state.targetVersion || state.targetVersion !== dismissedVersion);
  const showMinimizedBadge =
    !isModalOpen &&
    isMinimized &&
    (isDownloading || isDownloaded || isInstalling || isError);

  const startInstall = async () => {
    if (!window.electronAPI?.updaterStartInstall || busy) {
      return;
    }
    setBusy(true);
    const result = await window.electronAPI.updaterStartInstall();
    if (!result.success) {
      setState((prev) => ({
        ...prev,
        stage: "error",
        error: result.error ?? "Failed to start the updater.",
        message: "Update failed.",
        updatedAt: Date.now(),
      }));
    }
    setBusy(false);
  };

  const clampedProgress =
    typeof state.progressPercent === "number" && Number.isFinite(state.progressPercent)
      ? Math.max(0, Math.min(100, Math.round(state.progressPercent)))
      : isDownloaded || isInstalling
        ? 100
        : 0;
  const displayProgress = isPreparing ? Math.min(clampedProgress, 95) : clampedProgress;

  if (!showAvailableEntry && !showMinimizedBadge && !isModalOpen) {
    return null;
  }

  return (
    <>
      <div className="z-20">
        {showMinimizedBadge ? (
          <div className="w-full">
            <button
              onClick={() => {
                setIsMinimized(false);
                setIsModalOpen(true);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300 ${
                isDownloaded
                  ? "bg-[#1A162F] text-white shadow-md"
                  : "border border-[#1A162F]/10 bg-[#1A162F]/5 text-[#1A162F]"
              }`}
            >
              {isDownloaded ? (
                <CheckCircle size={16} weight="bold" className="shrink-0 text-white" />
              ) : (
                <ArrowClockwise
                  size={16}
                  weight="bold"
                  className={`shrink-0 ${isError ? "text-[#C24A3A]" : "animate-spin text-[#1A162F]"}`}
                />
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className={`truncate text-xs font-medium ${isDownloaded ? "text-white" : "text-[#1A162F]"}`}>
                  {isDownloaded ? "Update ready to install" : isError ? "Update failed" : "Downloading update..."}
                </p>
                {!isDownloaded && !isError ? (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-1 rounded-full bg-[#1A162F] transition-all duration-300"
                      style={{ width: `${displayProgress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </button>
          </div>
        ) : null}

        {showAvailableEntry ? (
          <div className={showMinimizedBadge ? "mt-2 w-full" : "w-full"}>
            <div className="flex items-center rounded-lg border border-[#1A162F]/10 bg-[#1A162F]/5 p-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(true);
                  setIsMinimized(false);
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md text-xs font-medium text-[#1A162F]"
              >
                <DownloadSimple size={16} weight="bold" />
                Update available
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isModalOpen ? createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-[#1A162F]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A162F]/5 text-[#1A162F]">
                  {isError ? (
                    <WarningCircle size={24} weight="bold" />
                  ) : isDownloaded ? (
                    <CheckCircle size={24} weight="bold" />
                  ) : (
                    <DownloadSimple size={24} weight="bold" />
                  )}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A162F]">
                    {isError ? "Update failed" : isDownloaded ? "Update ready to install" : "Update available"}
                  </h3>
                  <p className="text-xs text-[#666F8D]">
                    {state.targetVersion ? `Version ${state.targetVersion}` : "Version pending"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIsMinimized(true);
                }}
                className="rounded-lg p-2 text-[#666F8D] transition-colors hover:bg-gray-50 hover:text-[#1A162F]"
                title="Minimize"
              >
                <ArrowsInSimple size={20} weight="bold" />
              </button>
            </div>

            <div className="px-6 py-6">
              {isError ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-[#666F8D]">{state.error ?? "The updater could not finish."}</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1A162F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2B2550]"
                    onClick={() => {
                      void startInstall();
                    }}
                  >
                    <ArrowClockwise size={16} weight="bold" />
                    Try again
                  </button>
                </div>
              ) : isDownloaded ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-2">
                  <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A162F]/5 text-[#1A162F]">
                    <CheckCircle size={32} weight="bold" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#1A162F]">Update ready to install</h4>
                  <p className="max-w-[280px] text-center text-sm text-[#666F8D]">
                    {state.targetVersion
                      ? `Version ${state.targetVersion} has been downloaded. Restart the app to apply the update.`
                      : "The update has been downloaded. Restart the app to apply the update."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1A162F]">
                      {isPreparing ? "Preparing update..." : isInstalling ? "Installing..." : "Downloading update..."}
                    </span>
                    <span className="font-semibold text-[#1A162F]">{`${displayProgress}%`}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="relative h-2.5 overflow-hidden rounded-full bg-[#1A162F] transition-all duration-300 ease-out"
                      style={{ width: `${displayProgress}%` }}
                    >
                      <div className="absolute inset-0 animate-pulse bg-white/20" />
                    </div>
                  </div>
                  <p className="mt-2 text-center text-xs text-[#666F8D]">
                    You can minimize this window. The update will continue in the background.
                  </p>
                </div>
              )}
            </div>

            {isDownloaded ? (
              <div className="flex items-center justify-end gap-3 bg-gray-50 px-6 py-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsMinimized(true);
                  }}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-[#666F8D] transition-colors hover:bg-gray-200"
                >
                  Later
                </button>
                <button
                  onClick={() => {
                    if (window.electronAPI?.updaterInstall) {
                      void window.electronAPI.updaterInstall();
                    }
                  }}
                  className="rounded-xl bg-[#1A162F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1A162F]/90"
                >
                  Restart and install
                </button>
              </div>
            ) : isAvailable ? (
              <div className="flex items-center justify-end gap-3 bg-gray-50 px-6 py-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setDismissedVersion(state.targetVersion ?? "dismissed");
                  }}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-[#666F8D] transition-colors hover:bg-gray-200"
                >
                  Later
                </button>
                <button
                  onClick={() => {
                    void startInstall();
                  }}
                  disabled={busy}
                  className="rounded-xl bg-[#1A162F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1A162F]/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Starting..." : "Update now"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      , document.body) : null}
    </>
  );
}
