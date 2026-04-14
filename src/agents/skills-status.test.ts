import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillEntry } from "./skills/types.js";
import { withEnv } from "../test-utils/env.js";
import { writeSkill } from "./skills.e2e-test-helpers.js";
import { buildGlobalSkillStatus, buildWorkspaceSkillStatus } from "./skills-status.js";

describe("buildWorkspaceSkillStatus", () => {
  it("does not surface install options for OS-scoped skills on unsupported platforms", () => {
    if (process.platform === "win32") {
      // Keep this simple; win32 platform naming is already explicitly handled elsewhere.
      return;
    }

    const mismatchedOs = process.platform === "darwin" ? "linux" : "darwin";

    const entry: SkillEntry = {
      skill: {
        name: "os-scoped",
        description: "test",
        source: "test",
        filePath: "/tmp/os-scoped",
        baseDir: "/tmp",
        disableModelInvocation: false,
      },
      frontmatter: {},
      metadata: {
        os: [mismatchedOs],
        requires: { bins: ["fakebin"] },
        install: [
          {
            id: "brew",
            kind: "brew",
            formula: "fake",
            bins: ["fakebin"],
            label: "Install fake (brew)",
          },
        ],
      },
    };

    const report = buildWorkspaceSkillStatus("/tmp/ws", { entries: [entry] });
    expect(report.skills).toHaveLength(1);
    expect(report.skills[0]?.install).toEqual([]);
  });
});

describe("buildGlobalSkillStatus", () => {
  it("merges shared and agent workspace skills into one catalog", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-status-"));
    const bundledDir = path.join(rootDir, ".bundled");
    const managedDir = path.join(rootDir, ".managed");
    const firstWorkspace = path.join(rootDir, "workspace-main");
    const secondWorkspace = path.join(rootDir, "workspace-ops");

    await writeSkill({
      dir: path.join(bundledDir, "built-in"),
      name: "built-in",
      description: "Bundled skill",
      body: "# Built-in\n",
    });
    await writeSkill({
      dir: path.join(managedDir, "shared-skill"),
      name: "shared-skill",
      description: "Shared skill",
      body: "# Shared\n",
    });
    await writeSkill({
      dir: path.join(firstWorkspace, "skills", "main-skill"),
      name: "main-skill",
      description: "Main workspace skill",
      body: "# Main\n",
    });
    await writeSkill({
      dir: path.join(secondWorkspace, "skills", "ops-skill"),
      name: "ops-skill",
      description: "Ops workspace skill",
      body: "# Ops\n",
    });

    const report = withEnv({ OPENCLAW_BUNDLED_SKILLS_DIR: bundledDir }, () =>
      buildGlobalSkillStatus({
        config: {
          agents: {
            list: [
              { id: "main", workspace: firstWorkspace, default: true },
              { id: "ops", workspace: secondWorkspace },
            ],
          },
        },
        managedSkillsDir: managedDir,
      }),
    );

    expect(report.scope).toBe("global");
    expect(report.skills.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["built-in", "shared-skill", "main-skill", "ops-skill"]),
    );
  });
});
