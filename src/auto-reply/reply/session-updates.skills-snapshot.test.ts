import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorkspaceSkillSnapshot } from "../../agents/skills.js";
import { getSkillsSnapshotVersion } from "../../agents/skills/refresh.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { ensureSkillSnapshot } from "./session-updates.js";

vi.mock("../../agents/skills.js", () => ({
  buildWorkspaceSkillSnapshot: vi.fn(() => ({
    prompt: "skills prompt",
    skills: [{ name: "clawddocs" }],
    version: 0,
  })),
}));

vi.mock("../../agents/skills/refresh.js", () => ({
  ensureSkillsWatcher: vi.fn(),
  getSkillsSnapshotVersion: vi.fn(() => 0),
}));

vi.mock("../../infra/skills-remote.js", () => ({
  getRemoteSkillEligibility: vi.fn(() => ({})),
}));

describe("ensureSkillSnapshot", () => {
  let previousFastEnv: string | undefined;

  beforeEach(() => {
    previousFastEnv = process.env.OPENCLAW_TEST_FAST;
    delete process.env.OPENCLAW_TEST_FAST;
  });

  afterEach(() => {
    if (previousFastEnv === undefined) {
      delete process.env.OPENCLAW_TEST_FAST;
    } else {
      process.env.OPENCLAW_TEST_FAST = previousFastEnv;
    }
    vi.clearAllMocks();
  });

  it("refreshes stale snapshots even when snapshot version is 0", async () => {
    vi.mocked(getSkillsSnapshotVersion).mockReturnValue(0);
    vi.mocked(buildWorkspaceSkillSnapshot).mockReturnValue({
      prompt: "skills prompt",
      skills: [{ name: "clawddocs" }],
      version: 0,
    });

    const sessionEntry: SessionEntry = {
      sessionId: "session-1",
      updatedAt: 1,
      skillsSnapshot: {
        prompt: "old prompt",
        skills: [{ name: "old-skill" }],
      },
    };
    const sessionStore: Record<string, SessionEntry> = { k1: { ...sessionEntry } };

    const result = await ensureSkillSnapshot({
      sessionEntry,
      sessionStore,
      sessionKey: "k1",
      isFirstTurnInSession: false,
      workspaceDir: "/tmp/workspace",
      cfg: {} as OpenClawConfig,
    });

    expect(buildWorkspaceSkillSnapshot).toHaveBeenCalledTimes(1);
    expect(result.skillsSnapshot?.skills.map((skill) => skill.name)).toEqual(["clawddocs"]);
    expect(sessionStore.k1.skillsSnapshot?.skills.map((skill) => skill.name)).toEqual([
      "clawddocs",
    ]);
  });

  it("keeps snapshot when existing version already matches", async () => {
    vi.mocked(getSkillsSnapshotVersion).mockReturnValue(2);

    const sessionEntry: SessionEntry = {
      sessionId: "session-2",
      updatedAt: 1,
      skillsSnapshot: {
        prompt: "current prompt",
        skills: [{ name: "weather" }],
        version: 2,
      },
    };
    const sessionStore: Record<string, SessionEntry> = { k2: { ...sessionEntry } };

    const result = await ensureSkillSnapshot({
      sessionEntry,
      sessionStore,
      sessionKey: "k2",
      isFirstTurnInSession: false,
      workspaceDir: "/tmp/workspace",
      cfg: {} as OpenClawConfig,
    });

    expect(buildWorkspaceSkillSnapshot).not.toHaveBeenCalled();
    expect(result.skillsSnapshot?.skills.map((skill) => skill.name)).toEqual(["weather"]);
    expect(sessionStore.k2.skillsSnapshot?.skills.map((skill) => skill.name)).toEqual(["weather"]);
  });
});
