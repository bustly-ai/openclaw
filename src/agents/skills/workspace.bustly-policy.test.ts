import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadSkillsFromDirMock, defaultTokensRef } = vi.hoisted(() => ({
  loadSkillsFromDirMock: vi.fn(),
  defaultTokensRef: { current: [] as string[] },
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  formatSkillsForPrompt: vi.fn(() => ""),
  loadSkillsFromDir: (params: unknown) => loadSkillsFromDirMock(params),
}));

vi.mock("../../bustly/skill-catalog.js", () => ({
  resolveBustlyDefaultInstalledSkillTokens: () => new Set(defaultTokensRef.current),
}));

describe("workspace bundled skill policy", () => {
  let tempRoot: string;
  let bundledDir: string;
  let managedDir: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), "openclaw-skill-policy-"));
    bundledDir = path.join(tempRoot, "bustly-skills", "skills");
    managedDir = path.join(tempRoot, "managed");
    mkdirSync(path.join(bundledDir, "default-skill"), { recursive: true });
    mkdirSync(path.join(bundledDir, "bundled-only"), { recursive: true });
    mkdirSync(path.join(managedDir, "managed-skill"), { recursive: true });
    writeFileSync(path.join(bundledDir, "default-skill", "SKILL.md"), "# default\n");
    writeFileSync(path.join(bundledDir, "bundled-only", "SKILL.md"), "# bundled\n");
    writeFileSync(path.join(managedDir, "managed-skill", "SKILL.md"), "# managed\n");

    loadSkillsFromDirMock.mockReset();
    defaultTokensRef.current = [];

    loadSkillsFromDirMock.mockImplementation((params: {
      dir: string;
      source: string;
    }) => {
      const basename = path.basename(params.dir);
      if (params.source === "openclaw-bundled") {
        if (basename === "default-skill") {
          return [{
            name: "default-skill",
            description: "default",
            baseDir: params.dir,
            filePath: `${params.dir}/SKILL.md`,
            source: "openclaw-bundled",
          }];
        }
        if (basename === "bundled-only") {
          return [{
            name: "bundled-only",
            description: "bundled only",
            baseDir: params.dir,
            filePath: `${params.dir}/SKILL.md`,
            source: "openclaw-bundled",
          }];
        }
        return [];
      }
      if (params.source === "openclaw-managed") {
        if (basename === "managed-skill") {
          return [{
            name: "managed-skill",
            description: "managed",
            baseDir: params.dir,
            filePath: `${params.dir}/SKILL.md`,
            source: "openclaw-managed",
          }];
        }
        return [];
      }
      return [];
    });
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it("filters bustly-skills bundled entries by default-installed tokens", async () => {
    defaultTokensRef.current = ["default-skill"];
    const mod = await import("./workspace.js");
    const entries = mod.loadGlobalSkillEntries({
      bundledSkillsDir: bundledDir,
      managedSkillsDir: managedDir,
      extraSkillsDirs: [],
    });

    const names = entries.map((entry) => entry.skill.name);
    expect(names).toContain("default-skill");
    expect(names).toContain("managed-skill");
    expect(names).not.toContain("bundled-only");
  });

  it("drops all non-managed bundled skills when default-installed token set is empty", async () => {
    defaultTokensRef.current = [];
    const mod = await import("./workspace.js");
    const entries = mod.loadGlobalSkillEntries({
      bundledSkillsDir: bundledDir,
      managedSkillsDir: managedDir,
      extraSkillsDirs: [],
    });

    const names = entries.map((entry) => entry.skill.name);
    expect(names).toEqual(["managed-skill"]);
  });

  it("does not enforce policy for non-bustly bundled directories", async () => {
    defaultTokensRef.current = [];
    const legacyBundledDir = path.join(tempRoot, "legacy-skills");
    mkdirSync(path.join(legacyBundledDir, "default-skill"), { recursive: true });
    mkdirSync(path.join(legacyBundledDir, "bundled-only"), { recursive: true });
    writeFileSync(path.join(legacyBundledDir, "default-skill", "SKILL.md"), "# default\n");
    writeFileSync(path.join(legacyBundledDir, "bundled-only", "SKILL.md"), "# bundled\n");

    const mod = await import("./workspace.js");
    const entries = mod.loadGlobalSkillEntries({
      bundledSkillsDir: legacyBundledDir,
      managedSkillsDir: managedDir,
      extraSkillsDirs: [],
    });

    const names = entries.map((entry) => entry.skill.name);
    expect(names).toContain("default-skill");
    expect(names).toContain("bundled-only");
    expect(names).toContain("managed-skill");
  });
});
