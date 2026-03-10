import Lottie from "lottie-react";
import loadingAnimation from "../../../assets/lottie/loading.json";

export default function GlobalLoading() {
  return (
    <div className="onboard-loading">
      <div className="onboard-loading-minimal">
        <Lottie animationData={loadingAnimation} loop style={{ width: 156, height: 156 }} />
        <p className="onboard-loading-title">Starting Bustly</p>
      </div>
    </div>
  );
}
