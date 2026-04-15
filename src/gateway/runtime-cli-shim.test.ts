import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureGatewayRuntimeCliShim,
  resolveGatewayRuntimeBustlyCliScriptPath,
  resolveGatewayRuntimeCliPath,
} from "./runtime-cli-shim.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-runtime-cli-shim-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("gateway runtime cli shim", () => {
  it("resolves the bundled cli and bustly ops script in repo layouts", () => {
    const cliPath = resolveGatewayRuntimeCliPath({
      cwd: repoRoot,
      moduleUrl: import.meta.url,
    });
    const bustlyScriptPath = resolveGatewayRuntimeBustlyCliScriptPath({
      cwd: repoRoot,
      moduleUrl: import.meta.url,
    });

    expect(cliPath).toBe(path.join(repoRoot, "openclaw.mjs"));
    expect(bustlyScriptPath).toBe(path.join(repoRoot, "bustly-skills", "scripts", "bustly-ops.js"));
  });

  it("writes openclaw and bustly shims into the shared runtime bin dir", () => {
    const stateDir = makeTempDir();
    const shim = ensureGatewayRuntimeCliShim({
      stateDir,
      runtimeCommand: process.execPath,
      cwd: repoRoot,
      moduleUrl: import.meta.url,
    });

    expect(shim).not.toBeNull();
    expect(shim?.shimDir).toBe(path.join(stateDir, "gateway", "bin"));
    expect(shim?.openclawShimPath).toBe(
      path.join(stateDir, "gateway", "bin", process.platform === "win32" ? "openclaw.cmd" : "openclaw"),
    );
    expect(fs.existsSync(shim!.openclawShimPath)).toBe(true);
    expect(shim?.bustlyShimPath).toBe(
      path.join(stateDir, "gateway", "bin", process.platform === "win32" ? "bustly.cmd" : "bustly"),
    );
    expect(fs.existsSync(shim!.bustlyShimPath!)).toBe(true);

    const openclawShimContent = fs.readFileSync(shim!.openclawShimPath, "utf-8");
    const bustlyShimContent = fs.readFileSync(shim!.bustlyShimPath!, "utf-8");
    expect(openclawShimContent).toContain(process.execPath);
    expect(openclawShimContent).toContain("openclaw.mjs");
    expect(bustlyShimContent).toContain("bustly-ops.js");
  });
});
