import Lottie from "lottie-react";
import { WarningCircle } from "@phosphor-icons/react";
import loadingAnimation from "../../../assets/lottie/loading.json";

type GlobalLoadingProps = {
  text?: string;
  tone?: "loading" | "error";
};

export default function GlobalLoading({ text = "Loading...", tone = "loading" }: GlobalLoadingProps) {
  return (
    <div className="onboard-loading">
      <div className="onboard-loading-minimal">
        {tone === "error" ? (
          <div className="flex h-[156px] w-[156px] items-center justify-center rounded-full bg-red-50 text-red-500">
            <WarningCircle size={64} weight="bold" />
          </div>
        ) : (
          <Lottie animationData={loadingAnimation} loop style={{ width: 156, height: 156 }} />
        )}
        <p className={`onboard-loading-title ${tone === "error" ? "text-red-600" : ""}`}>{text}</p>
      </div>
    </div>
  );
}
