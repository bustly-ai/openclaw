import process from "node:process";
import { startGatewayServer } from "../../../../src/gateway/server.js";
import { normalizeEnv } from "../../../../src/infra/env.js";
import { installProcessWarningFilter } from "../../../../src/infra/warning-filter.js";
import { defaultRuntime } from "../../../../src/runtime.js";
import { runGatewayLoop } from "../../../../src/cli/gateway-cli/run-loop.js";
import { setConsoleTimestampPrefix } from "../../../../src/logging/console.js";

type GatewayBindMode = "loopback" | "lan" | "tailnet" | "auto" | "custom";

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
  defaultRuntime.error(
    "[openclaw] Failed to start gateway worker:",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  defaultRuntime.exit(1);
});
