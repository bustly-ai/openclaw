import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSkillManageTool } from "./skill-manage-tool.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function createWorkspace() {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skill-manage-"));
  tempDirs.push(workspaceDir);
  return workspaceDir;
}

describe("skill_manage", () => {
  it("creates a workspace skill and support files", async () => {
    const workspaceDir = await createWorkspace();
    const tool = createSkillManageTool({ workspaceDir });
    expect(tool).toBeTruthy();
    if (!tool) {
      throw new Error("missing skill_manage tool");
    }

    const result = await tool.execute("call-1", {
      action: "upsert",
      skillName: "repeatable-handoff",
      description: "Codify a reusable handoff workflow",
      body: "# Repeatable Handoff\n\n1. Summarize current state.\n2. Call out blockers.\n",
      supportFiles: [
        {
          path: "examples/checklist.md",
          content: "- summary\n- blocker\n",
        },
      ],
    });

    const details = result.details as { status?: string; filesWritten?: string[] };
    expect(details.status).toBe("updated");
    expect(details.filesWritten).toContain("SKILL.md");
    expect(details.filesWritten).toContain("examples/checklist.md");

    const skillMd = await fs.readFile(
      path.join(workspaceDir, "skills", "repeatable-handoff", "SKILL.md"),
      "utf-8",
    );
    expect(skillMd).toContain("name: repeatable-handoff");
    expect(skillMd).toContain("description: Codify a reusable handoff workflow");
    expect(skillMd).toContain("# Repeatable Handoff");
  });

  it("deletes an existing workspace skill", async () => {
    const workspaceDir = await createWorkspace();
    const tool = createSkillManageTool({ workspaceDir });
    expect(tool).toBeTruthy();
    if (!tool) {
      throw new Error("missing skill_manage tool");
    }

    await tool.execute("call-1", {
      action: "upsert",
      skillName: "cleanup-skill",
      description: "Temp skill",
      body: "# Temp\n",
    });

    const deleted = await tool.execute("call-2", {
      action: "delete",
      skillName: "cleanup-skill",
    });
    const details = deleted.details as { deleted?: boolean };
    expect(details.deleted).toBe(true);
    await expect(fs.stat(path.join(workspaceDir, "skills", "cleanup-skill"))).rejects.toThrow();
  });
});
