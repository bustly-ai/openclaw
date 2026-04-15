import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGatewayRuntimeCliPath } from "../../../../src/gateway/runtime-cli-shim.js";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

type CliLogger = {
  info?: (message: string) => void;
  error?: (message: string) => void;
};

export function resolveOpenClawCliPath(logger?: CliLogger): string | null {
  const cliPath = resolveGatewayRuntimeCliPath({
    cwd: process.cwd(),
    argv1: process.argv[1],
    moduleUrl: import.meta.url,
    resourcesPath: process.resourcesPath,
  });
  if (cliPath) {
    logger?.info?.(`[CLI] resolved ${cliPath} -> ${existsSync(cliPath) ? "found" : "missing"}`);
    if (existsSync(cliPath)) {
      logger?.info?.(`Found OpenClaw CLI at: ${cliPath}`);
      return cliPath;
    }
  }

  logger?.error?.("OpenClaw CLI not found in bundled locations");
  return null;
}

export function resolveElectronRunAsNodeExecPath(): string {
  const execPath = process.execPath?.trim();
  if (!execPath) {
    return "";
  }
  if (process.platform !== "darwin") {
    return execPath;
  }

  try {
    const macOsDir = dirname(execPath);
    const contentsDir = dirname(macOsDir);
    const appName = basename(execPath).trim();
    const helperAppName = `${appName} Helper`;
    const helperExecPath = join(
      contentsDir,
      "Frameworks",
      `${helperAppName}.app`,
      "Contents",
      "MacOS",
      helperAppName,
    );
    if (existsSync(helperExecPath)) {
      return helperExecPath;
    }
  } catch {
    // Fall back to the main executable if helper resolution fails.
  }

  return execPath;
}
