import { useState } from "react";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

export default function App() {
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReload = async () => {
    if (reloading) {
      return;
    }
    setReloading(true);
    setError(null);
    try {
      const result = await window.electronAPI.reloadRemoteRenderer();
      if (!result.success) {
        setError(result.error ?? "Bustly could not retry the bundled renderer entry.");
        setReloading(false);
      }
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : String(reloadError));
      setReloading(false);
    }
  };

  return (
    <div className="onboard-loading">
      <div className="onboard-loading-minimal">
        <div className="flex h-[116px] w-[116px] items-center justify-center text-red-500">
          <WarningCircle size={44} weight="bold" />
        </div>
        <p className="onboard-loading-title">Bustly could not load the bundled renderer.</p>
        <p className="mt-2 max-w-[360px] text-center text-sm leading-6 text-[#666F8D]">
          Reload to retry the local HTML entrypoint. If this build was packaged without a synced renderer entry, rebuild
          the desktop app.
        </p>
        {error ? (
          <p className="mt-3 max-w-[360px] text-center text-sm leading-6 text-[#C24A3A]">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleReload();
            }}
            disabled={reloading}
            className="inline-flex items-center gap-2 rounded-full bg-[#1A162F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B2550] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowClockwise size={16} weight="bold" className={reloading ? "animate-spin" : ""} />
            {reloading ? "Reloading..." : "Reload"}
          </button>
        </div>
      </div>
    </div>
  );
}
