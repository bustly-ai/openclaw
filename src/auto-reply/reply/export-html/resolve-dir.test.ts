import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resetExportHtmlDirCache, resolveExportHtmlDir } from "./resolve-dir.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-export-html-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(target: string, contents = "") {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, "utf8");
}

function createExportHtmlDir(root: string, relativeDir: string): string {
  const dir = path.join(root, relativeDir);
  writeFile(path.join(dir, "template.html"), "<html></html>");
  writeFile(path.join(dir, "template.css"), "body {}");
  writeFile(path.join(dir, "template.js"), "console.log('ok');");
  writeFile(path.join(dir, "vendor", "marked.min.js"), "");
  writeFile(path.join(dir, "vendor", "highlight.min.js"), "");
  return dir;
}

afterEach(() => {
  resetExportHtmlDirCache();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveExportHtmlDir", () => {
  it("uses packaged resources dist assets when available", () => {
    const root = makeTempDir();
    const resourcesPath = path.join(root, "Contents", "Resources");
    const expected = createExportHtmlDir(resourcesPath, path.join("dist", "export-html"));
    const modulePath = path.join(root, "Contents", "Resources", "app.asar", "dist", "main", "index.js");
    writeFile(modulePath, "");

    const resolved = resolveExportHtmlDir({
      moduleUrl: pathToFileURL(modulePath).href,
      resourcesPath,
      cwd: root,
      argv1: modulePath,
    });

    expect(resolved).toBe(expected);
  });

  it("falls back to the repo dist bundle from an electron main build", () => {
    const root = makeTempDir();
    writeFile(path.join(root, "package.json"), JSON.stringify({ name: "openclaw" }));
    const expected = createExportHtmlDir(root, path.join("dist", "export-html"));
    const modulePath = path.join(root, "apps", "electron", "dist", "main", "index.js");
    writeFile(modulePath, "");

    const resolved = resolveExportHtmlDir({
      moduleUrl: pathToFileURL(modulePath).href,
      cwd: path.join(root, "apps", "electron"),
      argv1: modulePath,
    });

    expect(resolved).toBe(expected);
  });

  it("finds vendored openclaw resources during electron development", () => {
    const root = makeTempDir();
    writeFile(path.join(root, "package.json"), JSON.stringify({ name: "openclaw" }));
    const expected = createExportHtmlDir(
      root,
      path.join("apps", "electron", "resources", "openclaw", "dist", "export-html"),
    );
    const modulePath = path.join(root, "apps", "electron", "dist", "main", "index.js");
    writeFile(modulePath, "");

    const resolved = resolveExportHtmlDir({
      moduleUrl: pathToFileURL(modulePath).href,
      cwd: path.join(root, "apps", "electron"),
      argv1: modulePath,
    });

    expect(resolved).toBe(expected);
  });
});
