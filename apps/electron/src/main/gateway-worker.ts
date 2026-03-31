import process from "node:process";
import { startGatewayServer } from "../../../../src/gateway/server.js";
import { normalizeEnv } from "../../../../src/infra/env.js";
import { formatUncaughtError } from "../../../../src/infra/errors.js";
import {
  installUnhandledRejectionHandler,
  isAbortError,
  isTransientNetworkError,
} from "../../../../src/infra/unhandled-rejections.js";
import { installProcessWarningFilter } from "../../../../src/infra/warning-filter.js";
import { defaultRuntime } from "../../../../src/runtime.js";
import { runGatewayLoop } from "../../../../src/cli/gateway-cli/run-loop.js";
import { setConsoleTimestampPrefix } from "../../../../src/logging/console.js";

type GatewayBindMode = "loopback" | "lan" | "tailnet" | "auto" | "custom";

type GatewayWorkerMessage =
  | {
      type: "gateway-worker-startup-error";
      kind: "config" | "runtime";
      message: string;
    }
  | {
      type: "gateway-worker-fatal";
      kind: "runtime";
      message: string;
    };

function notifyParent(message: GatewayWorkerMessage): void {
  if (typeof process.send !== "function") {
    return;
  }
  try {
    process.send(message);
  } catch {
    // Best effort only.
  }
}

function classifyGatewayStartupError(message: string): "config" | "runtime" {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid config") ||
    normalized.includes("legacy config") ||
    normalized.includes("requires gateway.") ||
    normalized.includes("requires gateway ") ||
    normalized.includes("gateway.bind=") ||
    normalized.includes("refusing to bind gateway") ||
    normalized.includes("tailscale") ||
    normalized.includes("allowedorigins") ||
    normalized.includes("trusted-proxy")
  ) {
    return "config";
  }
  return "runtime";
}

function parseGatewayPort(value: string | undefined): number {
  const parsed = Number.parseInt(value?.trim() || "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 17999;
}

function parseGatewayBind(value: string | undefined): GatewayBindMode {
  const normalized = value?.trim();
  if (
    normalized === "loopback" ||
    normalized === "lan" ||
    normalized === "tailnet" ||
    normalized === "auto" ||
    normalized === "custom"
  ) {
    return normalized;
  }
  return "loopback";
}

async function main(): Promise<void> {
  process.title = "openclaw-gateway";
  installProcessWarningFilter();
  normalizeEnv();
  setConsoleTimestampPrefix(true);
  process.on("unhandledRejection", (reason) => {
    if (isAbortError(reason) || isTransientNetworkError(reason)) {
      return;
    }
    notifyParent({
      type: "gateway-worker-fatal",
      kind: "runtime",
      message: formatUncaughtError(reason),
    });
  });
  installUnhandledRejectionHandler();
  process.on("uncaughtException", (error) => {
    notifyParent({
      type: "gateway-worker-fatal",
      kind: "runtime",
      message: formatUncaughtError(error),
    });
    defaultRuntime.error("[openclaw] Uncaught exception:", formatUncaughtError(error));
    defaultRuntime.exit(1);
  });

  const port = parseGatewayPort(process.env.OPENCLAW_GATEWAY_PORT);
  const bind = parseGatewayBind(process.env.OPENCLAW_ELECTRON_GATEWAY_BIND);

  await runGatewayLoop({
    runtime: defaultRuntime,
    lockPort: port,
    start: async () =>
      await startGatewayServer(port, {
        bind,
      }),
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  notifyParent({
    type: "gateway-worker-startup-error",
    kind: classifyGatewayStartupError(message),
    message,
  });
  defaultRuntime.error(
    "[openclaw] Failed to start gateway worker:",
    message,
  );
  defaultRuntime.exit(1);
});
