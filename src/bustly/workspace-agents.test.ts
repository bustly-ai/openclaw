import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  BUSTLY_PRESET_AGENT_FORCE_REFRESH_BEFORE,
  createBustlyWorkspaceAgent,
  createBustlyWorkspaceAgentSession,
  deleteBustlyWorkspaceAgent,
  ensureBustlyWorkspacePresetAgents,
  listBustlyWorkspaceAgentSessions,
  listBustlyWorkspaceAgents,
  updateBustlyWorkspaceAgent,
} from "./workspace-agents.js";

const { bootstrapMock, loadBootstrapAgentsMock } = vi.hoisted(() => ({
  bootstrapMock: vi.fn<(params: unknown) => Promise<void>>(async () => {}),
  loadBootstrapAgentsMock: vi.fn<
    () => Promise<Array<{ slug: string; label: string; icon?: string; isMain?: boolean }>>
  >(async () => []),
}));
const { runHeartbeatOnceMock, setHeartbeatsEnabledMock } = vi.hoisted(() => ({
  runHeartbeatOnceMock: vi.fn(async () => ({ status: "ran" as const, durationMs: 1 })),
  setHeartbeatsEnabledMock: vi.fn<(enabled: boolean) => void>(),
}));

vi.mock("./workspace-bootstrap.js", () => ({
  initializeBustlyWorkspaceBootstrap: (params: unknown) => bootstrapMock(params),
  loadEnabledBustlyWorkspaceBootstrapAgents: () => loadBootstrapAgentsMock(),
}));
vi.mock("../infra/heartbeat-runner.js", () => ({
  runHeartbeatOnce: (params: unknown) => runHeartbeatOnceMock(params),
  setHeartbeatsEnabled: (enabled: boolean) => setHeartbeatsEnabledMock(enabled),
}));

describe("workspace-agents", () => {
  let tempDir: string;
  let stateDir: string;
  let configPath: string;
  let prevStateDir: string | undefined;
  let prevConfigPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "openclaw-bustly-agents-"));
    stateDir = path.join(tempDir, "state");
    configPath = path.join(stateDir, "openclaw.json");
    prevStateDir = process.env.OPENCLAW_STATE_DIR;
    prevConfigPath = process.env.OPENCLAW_CONFIG_PATH;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.OPENCLAW_CONFIG_PATH = configPath;
    bootstrapMock.mockReset();
    bootstrapMock.mockResolvedValue(undefined);
    loadBootstrapAgentsMock.mockReset();
    loadBootstrapAgentsMock.mockResolvedValue([]);
    runHeartbeatOnceMock.mockReset();
    runHeartbeatOnceMock.mockResolvedValue({ status: "ran", durationMs: 1 });
    setHeartbeatsEnabledMock.mockReset();
    mkdirSync(stateDir, { recursive: true });
    const seedConfig: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "bustly-workspace-1-overview",
            name: "Overview",
            workspace: path.join(stateDir, "workspaces", "workspace-1", "agents", "overview"),
            default: true,
          },
        ],
      },
    };
    writeFileSync(configPath, JSON.stringify(seedConfig, null, 2));
  });

  afterEach(() => {
    if (prevStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = prevStateDir;
    }
    if (prevConfigPath === undefined) {
      delete process.env.OPENCLAW_CONFIG_PATH;
    } else {
      process.env.OPENCLAW_CONFIG_PATH = prevConfigPath;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates a bustly workspace agent and initializes bootstrap", async () => {
    const created = await createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "growth",
      displayName: "Growth",
      icon: "TrendUp",
      configPath,
      env: process.env,
    });
    expect(created.agentId).toBe("bustly-workspace-1-growth");
    expect(bootstrapMock).toHaveBeenCalledTimes(1);

    const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    const createdEntry = config.agents?.list?.find((entry) => entry.id === created.agentId);
    expect(createdEntry?.name).toBe("Growth");
    expect(createdEntry?.workspace).toBe(created.workspaceDir);

    const listed = listBustlyWorkspaceAgents({
      workspaceId: "workspace-1",
      configPath,
      env: process.env,
    });
    expect(listed.some((entry) => entry.agentId === "bustly-workspace-1-growth")).toBe(true);
  });

  it("creates a workspace agent from a non-ASCII name using a stable generated slug", async () => {
    const created = await createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "供应链助手",
      displayName: "供应链助手",
      configPath,
      env: process.env,
    });
    expect(created.agentId).toMatch(/^bustly-workspace-1-agent-[0-9a-f]{8}$/);
    expect(created.agentId).not.toBe("bustly-workspace-1-overview");
    const slug = created.agentId.slice("bustly-workspace-1-".length);
    expect(created.workspaceDir).toBe(path.join(stateDir, "workspaces", "workspace-1", "agents", slug));

    const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    const createdEntry = config.agents?.list?.find((entry) => entry.id === created.agentId);
    expect(createdEntry?.name).toBe("供应链助手");
  });

  it("rejects duplicate non-ASCII names because they resolve to the same stable slug", async () => {
    await createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "供应链助手",
      displayName: "供应链助手",
      configPath,
      env: process.env,
    });

    await expect(createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "供应链助手",
      displayName: "供应链助手",
      configPath,
      env: process.env,
    })).rejects.toThrow(/already exists in this workspace/i);
  });

  it("persists bustly workspace agent identity and skill metadata", async () => {
    const created = await createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "growth",
      displayName: "Growth",
      description: "Own performance marketing and weekly reporting.",
      skills: ["reports", "ads", "reports"],
      configPath,
      env: process.env,
    });

    let listed = listBustlyWorkspaceAgents({
      workspaceId: "workspace-1",
      configPath,
      env: process.env,
    });
    expect(listed.find((entry) => entry.agentId === created.agentId)).toMatchObject({
      agentId: created.agentId,
      name: "Growth",
      description: "Own performance marketing and weekly reporting.",
      skills: ["ads", "reports"],
    });
    expect(listed.find((entry) => entry.agentId === created.agentId)?.identityMarkdown).toContain(
      "Own performance marketing and weekly reporting.",
    );

    await updateBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentId: created.agentId,
      displayName: "Growth Ops",
      identityMarkdown: [
        "# IDENTITY.md - Agent Identity",
        "",
        "- Name: Growth Ops",
        "- Role: Commerce Operating Agent",
        "",
        "## Mission",
        "",
        "Run growth experiments and coordinate reporting.",
        "",
      ].join("\n"),
      skills: null,
      configPath,
      env: process.env,
    });

    listed = listBustlyWorkspaceAgents({
      workspaceId: "workspace-1",
      configPath,
      env: process.env,
    });
    expect(listed.find((entry) => entry.agentId === created.agentId)).toMatchObject({
      agentId: created.agentId,
      name: "Growth Ops",
      description: "Run growth experiments and coordinate reporting.",
    });
    expect(listed.find((entry) => entry.agentId === created.agentId)?.skills).toBeUndefined();
  });

  it("triggers initial heartbeat run after agent initialization when heartbeat is configured", async () => {
    await createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "finance",
      displayName: "Finance",
      heartbeat: {
        every: "15m",
        target: "none",
      },
      configPath,
      env: process.env,
    });

    expect(setHeartbeatsEnabledMock).toHaveBeenCalledWith(true);
    expect(runHeartbeatOnceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "bustly-workspace-1-finance",
        reason: "workspace-agent-init",
        force: true,
      }),
    );
  });

  it("creates and lists bustly workspace agent sessions", async () => {
    const created = await createBustlyWorkspaceAgentSession({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      label: "Daily pulse",
    });
    expect(created.sessionId).toBeTruthy();
    expect(created.sessionKey).toContain("conversation");

    const sessions = listBustlyWorkspaceAgentSessions({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      includeHeartbeatMainSessions: true,
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionKey).toBe(created.sessionKey);
    expect(sessions[0]?.kind).toBe("conversation");
    expect(sessions[0]?.name).toBe("Daily pulse");
  });

  it("lists scheduled sessions and hides cron run aliases", () => {
    const sessionsDir = path.join(stateDir, "agents", "bustly-workspace-1-overview", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify(
        {
          "agent:bustly-workspace-1-overview:cron:drink-water": {
            sessionId: "cron-session",
            updatedAt: 300,
            label: "提醒喝水",
          },
          "agent:bustly-workspace-1-overview:cron:drink-water:run:cron-session": {
            sessionId: "cron-session",
            updatedAt: 300,
            label: "提醒喝水",
          },
          "agent:bustly-workspace-1-overview:conversation:daily-pulse": {
            sessionId: "conversation-session",
            updatedAt: 200,
            label: "Daily pulse",
          },
        },
        null,
        2,
      ),
    );

    const hiddenByDefault = listBustlyWorkspaceAgentSessions({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
    });
    expect(hiddenByDefault).toEqual([]);

    const sessions = listBustlyWorkspaceAgentSessions({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      includeHeartbeatMainSessions: true,
    });

    expect(sessions).toEqual([
      {
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:cron:drink-water",
        kind: "scheduled",
        name: "提醒喝水",
        icon: undefined,
        updatedAt: 300,
      },
      {
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:conversation:daily-pulse",
        kind: "conversation",
        name: "Daily pulse",
        icon: undefined,
        updatedAt: 200,
      },
    ]);
  });

  it("lists heartbeat main sessions in the agent session list", () => {
    const sessionsDir = path.join(stateDir, "agents", "bustly-workspace-1-overview", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify(
        {
          "agent:bustly-workspace-1-overview:main": {
            sessionId: "heartbeat-session",
            updatedAt: 400,
            lastTo: "heartbeat",
            origin: {
              provider: "heartbeat",
              label: "heartbeat",
              from: "heartbeat",
              to: "heartbeat",
            },
            deliveryContext: {
              to: "heartbeat",
            },
          },
        },
        null,
        2,
      ),
    );

    const hiddenByDefault = listBustlyWorkspaceAgentSessions({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
    });
    expect(hiddenByDefault).toEqual([]);

    const sessions = listBustlyWorkspaceAgentSessions({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      includeHeartbeatMainSessions: true,
    });

    expect(sessions).toEqual([
      {
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:main",
        kind: "heartbeat",
        name: "Heartbeat",
        icon: undefined,
        updatedAt: 400,
      },
    ]);
  });

  it("deletes a non-main workspace agent and removes directories", async () => {
    const workspaceDir = path.join(stateDir, "workspaces", "workspace-1", "agents", "growth");
    const agentStateDir = path.join(stateDir, "agents", "bustly-workspace-1-growth");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    config.agents = {
      ...config.agents,
      list: [
        ...(config.agents?.list ?? []),
        {
          id: "bustly-workspace-1-growth",
          name: "Growth",
          workspace: workspaceDir,
        },
      ],
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    mkdirSync(workspaceDir, { recursive: true });
    mkdirSync(agentStateDir, { recursive: true });
    writeFileSync(path.join(workspaceDir, "AGENTS.md"), "seed");
    writeFileSync(path.join(agentStateDir, "sessions.json"), "{}");

    await deleteBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-growth",
      configPath,
      env: process.env,
    });

    const nextConfig = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    expect(nextConfig.agents?.list?.some((entry) => entry.id === "bustly-workspace-1-growth")).toBe(
      false,
    );
    expect(existsSync(workspaceDir)).toBe(false);
    expect(existsSync(agentStateDir)).toBe(false);
  });

  it("preserves the full workspace UUID when creating missing preset agents", async () => {
    const fullWorkspaceId = "412d0ede-8926-4f70-a611-b3b466596399";
    const normalizedWorkspaceId = "412d0ede";
    const seedConfig: OpenClawConfig = {
      agents: {
        list: [
          {
            id: `bustly-${normalizedWorkspaceId}-overview`,
            name: "Overview",
            workspace: path.join(
              stateDir,
              "workspaces",
              normalizedWorkspaceId,
              "agents",
              "overview",
            ),
            default: true,
          },
        ],
      },
    };
    writeFileSync(configPath, JSON.stringify(seedConfig, null, 2));

    const bootstrapped = await ensureBustlyWorkspacePresetAgents({
      workspaceId: fullWorkspaceId,
      workspaceName: "Workspace One",
      presets: [
        { slug: "overview", label: "Overview", isMain: true },
        { slug: "marketing", label: "Marketing", icon: "TrendUp" },
      ],
      configPath,
      env: process.env,
    });

    expect(bootstrapped).toBe(1);
    expect(bootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: fullWorkspaceId,
        workspaceDir: path.join(
          stateDir,
          "workspaces",
          normalizedWorkspaceId,
          "agents",
          "marketing",
        ),
        requireAgentMetadata: true,
      }),
    );
    const nextConfig = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    const marketingEntry = nextConfig.agents?.list?.find(
      (entry) => entry.id === `bustly-${normalizedWorkspaceId}-marketing`,
    );
    expect(marketingEntry?.heartbeat).toMatchObject({
      every: "30m",
      target: "none",
    });
  });

  it("loads preset agents from bootstrap config when presets are omitted", async () => {
    loadBootstrapAgentsMock.mockResolvedValueOnce([
      { slug: "overview", label: "Overview", icon: "Robot", isMain: true },
      { slug: "finance", label: "Finance", icon: "Wallet", isMain: false },
    ]);

    const bootstrapped = await ensureBustlyWorkspacePresetAgents({
      workspaceId: "workspace-1",
      workspaceName: "Workspace One",
      configPath,
      env: process.env,
    });

    expect(bootstrapped).toBe(1);
    expect(loadBootstrapAgentsMock).toHaveBeenCalledTimes(1);
    expect(bootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: "finance",
        requireAgentMetadata: true,
      }),
    );
    const nextConfig = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    const financeEntry = nextConfig.agents?.list?.find(
      (entry) => entry.id === "bustly-workspace-1-finance",
    );
    expect(financeEntry?.heartbeat).toMatchObject({
      every: "30m",
      target: "none",
    });
  });

  it("skips bootstrap when the preset agent already exists on disk", async () => {
    const existingDir = path.join(stateDir, "workspaces", "workspace-1", "agents", "marketing");
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(
      path.join(existingDir, ".bustly-agent.json"),
      JSON.stringify(
        {
          createdAt: BUSTLY_PRESET_AGENT_FORCE_REFRESH_BEFORE + 60_000,
        },
        null,
        2,
      ),
      "utf-8",
    );

    const bootstrapped = await ensureBustlyWorkspacePresetAgents({
      workspaceId: "workspace-1",
      workspaceName: "Workspace One",
      presets: [{ slug: "marketing", label: "Marketing", icon: "TrendUp", isMain: false }],
      configPath,
      env: process.env,
    });

    expect(bootstrapped).toBe(0);
    expect(bootstrapMock).not.toHaveBeenCalled();
    const metadata = JSON.parse(
      readFileSync(path.join(existingDir, ".bustly-agent.json"), "utf-8"),
    ) as { createdAt?: number };
    expect(metadata.createdAt).toBe(BUSTLY_PRESET_AGENT_FORCE_REFRESH_BEFORE + 60_000);

    const nextConfig = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    expect(
      nextConfig.agents?.list?.some((entry) => entry.id === "bustly-workspace-1-marketing"),
    ).toBe(true);
  });

  it("force-refreshes legacy preset agents created before the cutoff", async () => {
    const existingDir = path.join(stateDir, "workspaces", "workspace-1", "agents", "marketing");
    mkdirSync(existingDir, { recursive: true });
    const legacyCreatedAt = BUSTLY_PRESET_AGENT_FORCE_REFRESH_BEFORE - 60_000;
    writeFileSync(
      path.join(existingDir, ".bustly-agent.json"),
      JSON.stringify(
        {
          createdAt: legacyCreatedAt,
          icon: "OldIcon",
        },
        null,
        2,
      ),
      "utf-8",
    );

    const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
    config.agents = {
      ...config.agents,
      list: [
        ...(config.agents?.list ?? []),
        {
          id: "bustly-workspace-1-marketing",
          name: "Marketing",
          workspace: existingDir,
        },
      ],
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const bootstrapped = await ensureBustlyWorkspacePresetAgents({
      workspaceId: "workspace-1",
      workspaceName: "Workspace One",
      presets: [{ slug: "marketing", label: "Marketing", icon: "TrendUp", isMain: false }],
      configPath,
      env: process.env,
    });

    expect(bootstrapped).toBe(1);
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    const metadata = JSON.parse(
      readFileSync(path.join(existingDir, ".bustly-agent.json"), "utf-8"),
    ) as { createdAt?: number; icon?: string };
    expect(typeof metadata.createdAt).toBe("number");
    expect((metadata.createdAt ?? 0) > legacyCreatedAt).toBe(true);
    expect(metadata.icon).toBe("OldIcon");
  });

  it("preserves template-provided IDENTITY name for preset agents", async () => {
    bootstrapMock.mockImplementationOnce(async (params: unknown) => {
      const typed = params as { workspaceDir: string };
      mkdirSync(typed.workspaceDir, { recursive: true });
      writeFileSync(
        path.join(typed.workspaceDir, "IDENTITY.md"),
        [
          "<!-- Managed by Bustly bootstrap. Edit with care. -->",
          "# IDENTITY.md - Agent Identity",
          "",
          "- **Name:** Bustly Store Ops",
          "- **Role:** Store Operations Operator",
          "",
          "## Mission",
          "",
          "Keep {{WORKSPACE_NAME}} operationally healthy.",
          "",
        ].join("\n"),
      );
    });

    const created = await createBustlyWorkspaceAgent({
      workspaceId: "workspace-1",
      agentName: "store-ops",
      displayName: "Store Ops",
      preserveTemplateIdentityName: true,
      configPath,
      env: process.env,
    });

    const identity = readFileSync(path.join(created.workspaceDir, "IDENTITY.md"), "utf-8");
    expect(identity).toContain("- **Name:** Bustly Store Ops");
    expect(identity).not.toContain("- Name: Store Ops");
  });

  it("refreshes existing preset agent templates during ensure", async () => {
    const fullWorkspaceId = "412d0ede-8926-4f70-a611-b3b466596399";
    const normalizedWorkspaceId = "412d0ede";
    const marketingWorkspaceDir = path.join(
      stateDir,
      "workspaces",
      normalizedWorkspaceId,
      "agents",
      "marketing",
    );
    mkdirSync(marketingWorkspaceDir, { recursive: true });
    writeFileSync(path.join(marketingWorkspaceDir, "IDENTITY.md"), "stale identity\n");

    const seedConfig: OpenClawConfig = {
      agents: {
        list: [
          {
            id: `bustly-${normalizedWorkspaceId}-overview`,
            name: "Overview",
            workspace: path.join(stateDir, "workspaces", normalizedWorkspaceId, "agents", "overview"),
            default: true,
          },
          {
            id: `bustly-${normalizedWorkspaceId}-marketing`,
            name: "Marketing",
            workspace: marketingWorkspaceDir,
          },
        ],
      },
    };
    writeFileSync(configPath, JSON.stringify(seedConfig, null, 2));

    bootstrapMock.mockImplementation(async (params: unknown) => {
      const typed = params as { workspaceDir: string; agentName?: string };
      if (typed.agentName === "marketing") {
        mkdirSync(typed.workspaceDir, { recursive: true });
        writeFileSync(
          path.join(typed.workspaceDir, "IDENTITY.md"),
          [
            "<!-- Managed by Bustly bootstrap. Edit with care. -->",
            "# IDENTITY.md - Agent Identity",
            "",
            "- **Name:** Bustly Marketing",
            "- **Role:** Growth and Paid Acquisition Operator",
            "",
            "## Mission",
            "",
            "Protect growth.",
            "",
          ].join("\n"),
        );
      }
    });

    await ensureBustlyWorkspacePresetAgents({
      workspaceId: fullWorkspaceId,
      workspaceName: "Workspace One",
      presets: [
        { slug: "overview", label: "Overview", isMain: true },
        { slug: "marketing", label: "Marketing", icon: "TrendUp" },
      ],
      configPath,
      env: process.env,
    });

    expect(bootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: fullWorkspaceId,
        workspaceDir: marketingWorkspaceDir,
        agentName: "marketing",
      }),
    );
    const identity = readFileSync(path.join(marketingWorkspaceDir, "IDENTITY.md"), "utf-8");
    expect(identity).toContain("Bustly Marketing");
    expect(identity).not.toContain("stale identity");
  });
});
