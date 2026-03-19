import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWorkspaceSkillEntries } from "./skills.js";

const tempDirs: string[] = [];

async function createTempWorkspaceDir() {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-"));
  tempDirs.push(workspaceDir);
  return workspaceDir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function setupWorkspaceWithProsePlugin() {
  const workspaceDir = await createTempWorkspaceDir();
  const managedDir = path.join(workspaceDir, ".managed");
  const bundledDir = path.join(workspaceDir, ".bundled");
  const pluginRoot = path.join(workspaceDir, ".openclaw", "extensions", "open-prose");

  await fs.mkdir(path.join(pluginRoot, "skills", "prose"), { recursive: true });
  await fs.writeFile(
    path.join(pluginRoot, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "open-prose",
        skills: ["./skills"],
        configSchema: { type: "object", additionalProperties: false, properties: {} },
      },
      null,
      2,
    ),
    "utf-8",
  );
  await fs.writeFile(path.join(pluginRoot, "index.ts"), "export {};\n", "utf-8");
  await fs.writeFile(
    path.join(pluginRoot, "skills", "prose", "SKILL.md"),
    `---\nname: prose\ndescription: test\n---\n`,
    "utf-8",
  );

  return { workspaceDir, managedDir, bundledDir };
}

describe("loadWorkspaceSkillEntries", () => {
  it("handles an empty managed skills dir without throwing", async () => {
    const workspaceDir = await createTempWorkspaceDir();
    const managedDir = path.join(workspaceDir, ".managed");
    await fs.mkdir(managedDir, { recursive: true });

    const entries = loadWorkspaceSkillEntries(workspaceDir, {
      managedSkillsDir: managedDir,
      bundledSkillsDir: path.join(workspaceDir, ".bundled"),
    });

    expect(entries).toEqual([]);
  });

  it("includes plugin-shipped skills when the plugin is enabled", async () => {
    const { workspaceDir, managedDir, bundledDir } = await setupWorkspaceWithProsePlugin();

    const entries = loadWorkspaceSkillEntries(workspaceDir, {
      config: {
        plugins: {
          entries: { "open-prose": { enabled: true } },
        },
      },
      managedSkillsDir: managedDir,
      bundledSkillsDir: bundledDir,
    });

    expect(entries.map((entry) => entry.skill.name)).toContain("prose");
  });

  it("excludes plugin-shipped skills when the plugin is not allowed", async () => {
    const { workspaceDir, managedDir, bundledDir } = await setupWorkspaceWithProsePlugin();

    const entries = loadWorkspaceSkillEntries(workspaceDir, {
      config: {
        plugins: {
          allow: ["something-else"],
        },
      },
      managedSkillsDir: managedDir,
      bundledSkillsDir: bundledDir,
    });

    expect(entries.map((entry) => entry.skill.name)).not.toContain("prose");
  });

  it("derives a node install option from runtime package metadata", async () => {
    const workspaceDir = await createTempWorkspaceDir();
    const skillDir = path.join(workspaceDir, "skills", "ads-core-ops");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ads_core_ops\ndescription: test\nmetadata: {"openclaw":{"runtimePackage":"@bustly/skill-runtime-ads-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-ads-core-ops@^0.1.0","runtimeExecutable":"bustly-skill-ads"}}\n---\n`,
      "utf-8",
    );

    const entries = loadWorkspaceSkillEntries(workspaceDir, {
      managedSkillsDir: path.join(workspaceDir, ".managed"),
      bundledSkillsDir: path.join(workspaceDir, ".bundled"),
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.metadata?.install).toEqual([
      {
        id: "runtime-node",
        kind: "node",
        label: "Install @bustly/skill-runtime-ads-core-ops@^0.1.0 runtime",
        package: "@bustly/skill-runtime-ads-core-ops@^0.1.0",
        bins: ["bustly-skill-ads"],
      },
    ]);
    expect(entries[0]?.metadata?.requires).toEqual({
      bins: ["bustly-skill-ads"],
      anyBins: [],
      env: [],
      config: [],
    });
  });
});
