import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  createBustlyWorkspaceAgent,
  createBustlyWorkspaceAgentSession,
  deleteBustlyWorkspaceAgent,
  ensureBustlyWorkspacePresetAgents,
  listBustlyWorkspaceAgentSessions,
  listBustlyWorkspaceAgents,
  updateBustlyWorkspaceAgent,
} from "./workspace-agents.js";

const bootstrapMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("./workspace-bootstrap.js", () => ({
  initializeBustlyWorkspaceBootstrap: (params: unknown) => bootstrapMock(params),
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
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionKey).toBe(created.sessionKey);
    expect(sessions[0]?.name).toBe("Daily pulse");
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
            workspace: path.join(stateDir, "workspaces", normalizedWorkspaceId, "agents", "overview"),
            default: true,
          },
        ],
      },
    };
    writeFileSync(configPath, JSON.stringify(seedConfig, null, 2));

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
        workspaceDir: path.join(stateDir, "workspaces", normalizedWorkspaceId, "agents", "marketing"),
      }),
    );
  });
});
