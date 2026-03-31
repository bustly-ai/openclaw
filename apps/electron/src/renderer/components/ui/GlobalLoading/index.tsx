import Lottie from "lottie-react";
import { WarningCircle } from "@phosphor-icons/react";
import loadingAnimation from "../../../assets/lottie/loading.json";

type GlobalLoadingProps = {
  text?: string;
  tone?: "loading" | "error";
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }>;
};

export default function GlobalLoading({
  text = "Loading...",
  tone = "loading",
  actions = [],
}: GlobalLoadingProps) {
  return (
    <div className="onboard-loading">
      <div className="onboard-loading-minimal">
        {tone === "error" ? (
          <div className="flex h-[116px] w-[116px] items-center justify-center text-red-500">
            <WarningCircle size={44} weight="bold" />
          </div>
        ) : (
          <Lottie animationData={loadingAnimation} loop style={{ width: 156, height: 156 }} />
        )}
        <p className="onboard-loading-title">{text}</p>
        {actions.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {actions.map((action) => {
              const isSecondary = action.variant === "secondary";
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    isSecondary
                      ? "border border-[#D5D9E8] bg-white text-[#1A162F] hover:bg-[#F6F7FB]"
                      : "bg-[#1A162F] text-white hover:bg-[#2B2550]"
                  }`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
