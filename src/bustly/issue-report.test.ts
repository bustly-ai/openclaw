import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { createBustlyIssueReportArchive } from "./issue-report.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("createBustlyIssueReportArchive", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when state directory is missing", async () => {
    await expect(
      createBustlyIssueReportArchive({
        stateDir: "/tmp/openclaw-missing-state-dir",
      }),
    ).rejects.toThrow(/Bustly state directory not found/);
  });

  it("creates a zip archive with .bustly payload", async () => {
    const tempRoot = makeTempDir("openclaw-issue-report-");
    const stateDir = join(tempRoot, ".bustly");
    const nestedDir = join(stateDir, "workspace");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, "notes.txt"), "hello issue report", "utf-8");

    const outputDir = join(tempRoot, "reports");
    const result = await createBustlyIssueReportArchive({
      stateDir,
      outputDir,
      now: new Date("2026-04-13T01:01:01.000Z"),
    });

    expect(existsSync(result.archivePath)).toBe(true);
    expect(result.outputDir).toBe(outputDir);
    expect(result.stateDir).toBe(stateDir);

    const zip = await JSZip.loadAsync(readFileSync(result.archivePath));
    const payload = zip.file(".bustly/workspace/notes.txt");
    expect(payload).toBeTruthy();
    expect(await payload?.async("string")).toBe("hello issue report");
  });
});
