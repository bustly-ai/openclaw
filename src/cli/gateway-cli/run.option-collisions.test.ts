import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runRegisteredCli } from "../../test-utils/command-runner.js";
import { createCliRuntimeCapture } from "../test-runtime-capture.js";

const startGatewayServer = vi.fn(async (_port: number, _opts?: unknown) => ({
  close: vi.fn(async () => {}),
}));
const setGatewayWsLogStyle = vi.fn((_style: string) => undefined);
const setVerbose = vi.fn((_enabled: boolean) => undefined);
const forceFreePortAndWait = vi.fn(async (_port: number, _opts: unknown) => ({
  killed: [],
  waitedMs: 0,
  escalatedToSigkill: false,
}));
const ensureDevGatewayConfig = vi.fn(async (_opts?: unknown) => {});
const ensureBustlyCloudReady = vi.fn(async () => ({
  workspaceId: "workspace-1",
  agentId: "bustly-workspace-1-overview",
  workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
}));
const runGatewayLoop = vi.fn(async ({ start }: { start: () => Promise<unknown> }) => {
  await start();
});

const { defaultRuntime, resetRuntimeCapture, runtimeErrors } = createCliRuntimeCapture();

vi.mock("../../config/config.js", () => ({
  getConfigPath: () => "/tmp/openclaw-test-missing-config.json",
  loadConfig: () => ({}),
  readConfigFileSnapshot: async () => ({ exists: false }),
  resolveStateDir: () => "/tmp",
  resolveGatewayPort: () => 18789,
}));

vi.mock("../../gateway/auth.js", () => ({
  resolveGatewayAuth: (params: { authConfig?: { token?: string }; env?: NodeJS.ProcessEnv }) => ({
    mode: "token",
    token: params.authConfig?.token ?? params.env?.OPENCLAW_GATEWAY_TOKEN,
    password: undefined,
    allowTailscale: false,
  }),
}));

vi.mock("../../gateway/server.js", () => ({
  startGatewayServer: (port: number, opts?: unknown) => startGatewayServer(port, opts),
}));

vi.mock("../../gateway/ws-logging.js", () => ({
  setGatewayWsLogStyle: (style: string) => setGatewayWsLogStyle(style),
}));

vi.mock("../../globals.js", () => ({
  setVerbose: (enabled: boolean) => setVerbose(enabled),
}));

vi.mock("../../infra/gateway-lock.js", () => ({
  GatewayLockError: class GatewayLockError extends Error {},
}));

vi.mock("../../infra/ports.js", () => ({
  formatPortDiagnostics: () => [],
  inspectPortUsage: async () => ({ status: "free" }),
}));

vi.mock("../../logging/console.js", () => ({
  setConsoleSubsystemFilter: () => undefined,
  setConsoleTimestampPrefix: () => undefined,
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime,
}));

vi.mock("../command-format.js", () => ({
  formatCliCommand: (cmd: string) => cmd,
}));

vi.mock("../ports.js", () => ({
  forceFreePortAndWait: (port: number, opts: unknown) => forceFreePortAndWait(port, opts),
}));

vi.mock("./dev.js", () => ({
  ensureDevGatewayConfig: (opts?: unknown) => ensureDevGatewayConfig(opts),
}));

vi.mock("../../bustly/workspace-runtime.js", () => ({
  ensureBustlyCloudReady: (opts?: unknown) => ensureBustlyCloudReady(opts),
}));

vi.mock("./run-loop.js", () => ({
  runGatewayLoop: (params: { start: () => Promise<unknown> }) => runGatewayLoop(params),
}));

describe("gateway run option collisions", () => {
  let addGatewayRunCommand: typeof import("./run.js").addGatewayRunCommand;

  beforeAll(async () => {
    ({ addGatewayRunCommand } = await import("./run.js"));
  });

  beforeEach(() => {
    resetRuntimeCapture();
    startGatewayServer.mockClear();
    setGatewayWsLogStyle.mockClear();
    setVerbose.mockClear();
    forceFreePortAndWait.mockClear();
    ensureDevGatewayConfig.mockClear();
    ensureBustlyCloudReady.mockClear();
    runGatewayLoop.mockClear();
  });

  async function runGatewayCli(argv: string[]) {
    await runRegisteredCli({
      register: ((program: Command) => {
        const gateway = addGatewayRunCommand(program.command("gateway"));
        addGatewayRunCommand(gateway.command("run"));
      }) as (program: Command) => void,
      argv,
    });
  }

  it("forwards parent-captured options to `gateway run` subcommand", async () => {
    await runGatewayCli([
      "gateway",
      "run",
      "--token",
      "tok_run",
      "--allow-unconfigured",
      "--ws-log",
      "full",
      "--force",
    ]);

    expect(forceFreePortAndWait).toHaveBeenCalledWith(18789, expect.anything());
    expect(setGatewayWsLogStyle).toHaveBeenCalledWith("full");
    expect(startGatewayServer).toHaveBeenCalledWith(
      18789,
      expect.objectContaining({
        auth: expect.objectContaining({
          token: "tok_run",
        }),
      }),
    );
  });

  it("starts gateway when token mode has no configured token (startup bootstrap path)", async () => {
    await runGatewayCli(["gateway", "run", "--allow-unconfigured"]);

    expect(startGatewayServer).toHaveBeenCalledWith(
      18789,
      expect.objectContaining({
        bind: "loopback",
      }),
    );
  });

  it("runs bustly cloud preflight before startup when --cloud is enabled", async () => {
    await runGatewayCli(["gateway", "run", "--cloud", "--allow-unconfigured"]);

    expect(ensureBustlyCloudReady).toHaveBeenCalledWith({
      gatewayBind: undefined,
      gatewayPort: undefined,
      gatewayToken: undefined,
      userAgent: "openclaw-cloud",
    });
    expect(startGatewayServer).toHaveBeenCalledTimes(1);
  });

  it("forwards cloud runtime init overrides before gateway startup", async () => {
    await runGatewayCli([
      "gateway",
      "run",
      "--cloud",
      "--allow-unconfigured",
      "--port",
      "17999",
      "--bind",
      "lan",
      "--token",
      "cloud_tok",
    ]);

    expect(ensureBustlyCloudReady).toHaveBeenCalledWith({
      gatewayBind: "lan",
      gatewayPort: 17999,
      gatewayToken: "cloud_tok",
      userAgent: "openclaw-cloud",
    });
  });

  it("rejects --cloud with --dev", async () => {
    await expect(runGatewayCli(["gateway", "run", "--cloud", "--dev"])).rejects.toThrow(
      "__exit__:1",
    );
    expect(runtimeErrors.some((entry) => entry.includes("Cannot use --cloud with --dev."))).toBe(
      true,
    );
    expect(ensureBustlyCloudReady).not.toHaveBeenCalled();
    expect(ensureDevGatewayConfig).not.toHaveBeenCalled();
    expect(startGatewayServer).not.toHaveBeenCalled();
  });

  it("runs bustly cloud preflight for top-level gateway command", async () => {
    await runGatewayCli(["gateway", "--cloud", "--allow-unconfigured"]);

    expect(ensureBustlyCloudReady).toHaveBeenCalledWith({
      gatewayBind: undefined,
      gatewayPort: undefined,
      gatewayToken: undefined,
      userAgent: "openclaw-cloud",
    });
    expect(startGatewayServer).toHaveBeenCalledTimes(1);
  });

  it("rejects top-level gateway --cloud with --dev", async () => {
    await expect(runGatewayCli(["gateway", "--cloud", "--dev"])).rejects.toThrow("__exit__:1");
    expect(runtimeErrors.some((entry) => entry.includes("Cannot use --cloud with --dev."))).toBe(
      true,
    );
    expect(ensureBustlyCloudReady).not.toHaveBeenCalled();
    expect(ensureDevGatewayConfig).not.toHaveBeenCalled();
    expect(startGatewayServer).not.toHaveBeenCalled();
  });
});
