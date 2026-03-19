import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeSkill } from "../agents/skills.e2e-test-helpers.js";
import {
  hasBinaryMock,
  runCommandWithTimeoutMock,
  scanDirectoryWithSummaryMock,
} from "../agents/skills-install.test-mocks.js";
import { opsCommand } from "./ops.js";

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

vi.mock("../security/skill-scanner.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/skill-scanner.js")>()),
  scanDirectoryWithSummary: (...args: unknown[]) => scanDirectoryWithSummaryMock(...args),
}));

vi.mock("../shared/config-eval.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/config-eval.js")>();
  return {
    ...actual,
    hasBinary: (bin: string) => hasBinaryMock(bin),
    invalidateHasBinaryCache: vi.fn(),
  };
});

describe("opsCommand", () => {
  const runtime = {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
  const originalCwd = process.cwd();
  let workspaceDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ops-"));
    process.chdir(workspaceDir);
    scanDirectoryWithSummaryMock.mockResolvedValue({
      scannedFiles: 1,
      critical: 0,
      warn: 0,
      info: 0,
      findings: [],
    });
    await writeSkill({
      dir: path.join(workspaceDir, "skills", "ads_core_ops"),
      name: "ads_core_ops",
      description: "Unified advertising operations",
      metadata:
        '{"openclaw":{"skillKey":"ads_core_ops","aliases":["ads"],"commandNamespace":"bustly ops","discoveryCommand":"bustly ops ads help","defaultCommand":"bustly ops ads platforms","runtimePackage":"@bustly/skill-runtime-ads-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-ads-core-ops@^0.1.0","runtimeExecutable":"bustly-skill-ads"}}',
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("installs a missing runtime and dispatches to the runtime executable", async () => {
    const available = new Set<string>();
    hasBinaryMock.mockImplementation((bin: string) => available.has(bin));
    runCommandWithTimeoutMock.mockImplementation(async (argv: unknown) => {
      const command = argv as string[];
      if (command[0] === "npm") {
        available.add("bustly-skill-ads");
        return {
          code: 0,
          stdout: "installed",
          stderr: "",
          signal: null,
          killed: false,
        };
      }
      if (command[0] === "bustly-skill-ads") {
        return {
          code: 0,
          stdout: JSON.stringify({ ok: true, command }),
          stderr: "",
          signal: null,
          killed: false,
        };
      }
      throw new Error(`unexpected command: ${command.join(" ")}`);
    });

    await opsCommand(
      {
        skill: "ads",
        args: ["platforms", "--json"],
        config: { skills: { install: { nodeManager: "npm" } } },
      },
      runtime,
    );

    expect(runCommandWithTimeoutMock).toHaveBeenNthCalledWith(
      1,
      ["npm", "install", "-g", "--ignore-scripts", "@bustly/skill-runtime-ads-core-ops@^0.1.0"],
      expect.any(Object),
    );
    expect(runCommandWithTimeoutMock).toHaveBeenNthCalledWith(
      2,
      ["bustly-skill-ads", "platforms", "--json"],
      expect.objectContaining({ timeoutMs: 900_000 }),
    );
    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining("Installing ads_core_ops runtime"),
    );
    expect(runtime.log).toHaveBeenCalledWith(
      JSON.stringify({ ok: true, command: ["bustly-skill-ads", "platforms", "--json"] }),
    );
    expect(runtime.exit).not.toHaveBeenCalled();
  });

  it("fails cleanly for an unknown ops skill", async () => {
    await opsCommand({ skill: "unknown", args: [], config: {} }, runtime);

    expect(runtime.error).toHaveBeenCalledWith("Unknown ops skill: unknown");
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(runCommandWithTimeoutMock).not.toHaveBeenCalled();
  });

  it("supports skills declared with bustly namespace (without legacy bustly ops prefix)", async () => {
    await writeSkill({
      dir: path.join(workspaceDir, "skills", "ads_core_ops"),
      name: "ads_core_ops",
      description: "Unified advertising operations",
      metadata:
        '{"openclaw":{"skillKey":"ads_core_ops","aliases":["ads"],"commandNamespace":"bustly","discoveryCommand":"bustly-ads help","defaultCommand":"bustly-ads platforms","runtimePackage":"@bustly/skill-runtime-ads-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-ads-core-ops@^0.1.0","runtimeExecutable":"bustly-ads"}}',
    });

    const available = new Set<string>(["bustly-ads"]);
    hasBinaryMock.mockImplementation((bin: string) => available.has(bin));
    runCommandWithTimeoutMock.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ ok: true }),
      stderr: "",
      signal: null,
      killed: false,
    });

    await opsCommand(
      {
        skill: "ads",
        args: ["platforms"],
        config: { skills: { install: { nodeManager: "npm" } } },
      },
      runtime,
    );

    expect(runCommandWithTimeoutMock).toHaveBeenCalledTimes(1);
    expect(runCommandWithTimeoutMock).toHaveBeenCalledWith(
      ["bustly-ads", "platforms"],
      expect.objectContaining({ timeoutMs: 900_000 }),
    );
    expect(runtime.exit).not.toHaveBeenCalled();
  });
});
