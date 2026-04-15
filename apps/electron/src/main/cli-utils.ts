import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

type CliLogger = {
  info?: (message: string) => void;
  error?: (message: string) => void;
};

export type CliShim = {
  shimDir: string;
  shimPath: string;
};

type BundledCliShimOptions = {
  includeBundledNode?: boolean;
  resourcesPath?: string;
  appPath?: string;
};

type BundledBustlyPathsOptions = {
  resourcesPath?: string;
  appPath?: string;
};

function getOpenClawCliCandidates(): string[] {
  return [
    resolve(process.resourcesPath, "openclaw.mjs"),
    resolve(__dirname, "../../../openclaw.mjs"),
    resolve(__dirname, "../../../../openclaw.mjs"),
    resolve(__dirname, "../../../dist/cli.js"),
    resolve(__dirname, "../../dist/cli.js"),
  ];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function getBundledBustlyRootCandidates(options?: BundledBustlyPathsOptions): string[] {
  const resourcesPath = options?.resourcesPath || process.resourcesPath;
  const appPath = options?.appPath;

  return uniqueStrings([
    resolve(resourcesPath, "bustly-skills"),
    appPath ? resolve(appPath, "resources", "bustly-skills") : "",
    resolve(process.cwd(), "resources", "bustly-skills"),
    resolve(process.cwd(), "..", "..", "bustly-skills"),
    resolve(__dirname, "../../../resources/bustly-skills"),
    resolve(__dirname, "../../../../bustly-skills"),
    resolve(__dirname, "../../../../../bustly-skills"),
  ]);
}

export function resolveBundledBustlyCliScript(options?: BundledBustlyPathsOptions): string | null {
  for (const root of getBundledBustlyRootCandidates(options)) {
    const candidate = resolve(root, "scripts", "bustly-ops.js");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolveOpenClawCliPath(logger?: CliLogger): string | null {
  for (const candidate of getOpenClawCliCandidates()) {
    const exists = existsSync(candidate);
    logger?.info?.(`[CLI] check ${candidate} -> ${exists ? "found" : "missing"}`);
    if (exists) {
      logger?.info?.(`Found OpenClaw CLI at: ${candidate}`);
      return candidate;
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

function escapePosixSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveBustlyCliScriptPath(params: {
  resourcesPath: string;
  appPath?: string;
}): string | null {
  const bundledScript = resolveBundledBustlyCliScript({
    resourcesPath: params.resourcesPath,
    appPath: params.appPath,
  });

  if (bundledScript) {
    return bundledScript;
  }

  const candidateRoots = [
    resolve(process.cwd(), "resources", "bustly-skills"),
    resolve(process.cwd(), "..", "..", "bustly-skills"),
    resolve(__dirname, "../../../resources/bustly-skills"),
    resolve(__dirname, "../../../../bustly-skills"),
    resolve(__dirname, "../../../../../bustly-skills"),
  ];

  for (const root of candidateRoots) {
    const candidate = resolve(root, "scripts", "bustly-ops.js");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function writeCommandShim(params: {
  shimPath: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): void {
  const commandArgs = params.args ?? [];
  const envEntries = Object.entries(params.env ?? {}).filter(([, value]) => value.trim().length > 0);

  if (process.platform === "win32") {
    const envPrefix =
      envEntries.length > 0
        ? `${envEntries.map(([key, value]) => `set "${key}=${value}"`).join(" && ")} && `
        : "";
    const target = [`"${params.command}"`, ...commandArgs.map((arg) => `"${arg}"`), "%*"].join(" ");
    writeFileSync(params.shimPath, `@echo off\r\n${envPrefix}${target}\r\n`, "utf-8");
    return;
  }

  const exportLines = envEntries.map(
    ([key, value]) => `export ${key}=${escapePosixSingleQuoted(value)}`,
  );
  const execLine = `exec ${[params.command, ...commandArgs].map((value) => escapePosixSingleQuoted(value)).join(" ")} "$@"`;
  writeFileSync(
    params.shimPath,
    `#!/bin/sh\n${[...exportLines, execLine].join("\n")}\n`,
    { encoding: "utf-8", mode: 0o755 },
  );
  chmodSync(params.shimPath, 0o755);
}

function writeBustlyShim(params: {
  shimDir: string;
  runtimeExecPath: string;
  bustlyScriptPath: string;
}): void {
  const bustlyShimPath = resolve(params.shimDir, process.platform === "win32" ? "bustly.cmd" : "bustly");
  writeCommandShim({
    shimPath: bustlyShimPath,
    command: params.runtimeExecPath,
    args: [params.bustlyScriptPath],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
    },
  });
}

export function ensureBundledOpenClawShim(
  cliPath: string,
  stateDir: string,
  options?: BundledCliShimOptions,
): CliShim | null {
  const runtimeExecPath = resolveElectronRunAsNodeExecPath();
  if (!runtimeExecPath) {
    return null;
  }

  const shimDir = resolve(stateDir, "electron", "bin");
  const shimPath = resolve(shimDir, process.platform === "win32" ? "openclaw.cmd" : "openclaw");
  mkdirSync(shimDir, { recursive: true, mode: 0o755 });
  const resourcesPath = options?.resourcesPath || process.resourcesPath;
  const appPath = options?.appPath;
  writeCommandShim({
    shimPath,
    command: runtimeExecPath,
    args: [cliPath],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
    },
  });

  const bustlyScriptPath = resolveBustlyCliScriptPath({
    resourcesPath,
    appPath,
  });
  if (bustlyScriptPath) {
    writeBustlyShim({
      shimDir,
      runtimeExecPath,
      bustlyScriptPath,
    });
  }

  return { shimDir, shimPath };
}
