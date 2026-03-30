import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

type CliLogger = {
  info?: (message: string) => void;
  error?: (message: string) => void;
};

export type CliInvocation = {
  command: string;
  args: string[];
  isMjs: boolean;
  nodePath?: string;
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

function uniqueExistingPaths(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value || seen.has(value) || !existsSync(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizePlatform(value: string): "mac" | "windows" | "linux" | null {
  if (value === "darwin") {return "mac";}
  if (value === "win32") {return "windows";}
  if (value === "linux") {return "linux";}
  return null;
}

function normalizeArch(value: string): "arm64" | "x64" | null {
  if (value === "arm64") {return "arm64";}
  if (value === "x64") {return "x64";}
  return null;
}

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

export function resolveBundledBustlyBinDir(options?: BundledBustlyPathsOptions): string | null {
  for (const root of getBundledBustlyRootCandidates(options)) {
    const candidate = resolve(root, "bin");
    if (existsSync(resolve(candidate, process.platform === "win32" ? "bustly.cmd" : "bustly"))
      || existsSync(resolve(candidate, "bustly"))) {
      return candidate;
    }
  }
  return null;
}

export function resolveBundledBustlySkillsDir(options?: BundledBustlyPathsOptions): string | null {
  for (const root of getBundledBustlyRootCandidates(options)) {
    const candidate = resolve(root, "skills");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
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

export function resolveNodeBinary(options?: { includeBundled?: boolean }): string | null {
  const binaryName = process.platform === "win32" ? "node.exe" : "node";
  const envNodeBinary = process.env.OPENCLAW_NODE_BINARY?.trim() || null;
  const npmNodeBinary = process.env.NODE?.trim() || null;
  const nvmBin = process.env.NVM_BIN?.trim() || null;
  const envCandidates = [
    envNodeBinary,
    nvmBin ? resolve(nvmBin, binaryName) : null,
    nvmBin ? resolve(nvmBin, "node") : null,
    npmNodeBinary,
  ];
  const bundledCandidates: string[] = [];
  const discoveredCandidates: Array<string | null> = [];

  if (options?.includeBundled ?? true) {
    const platform = normalizePlatform(process.platform);
    const arch = normalizeArch(process.arch);
    const canonicalTarget = platform && arch ? `${platform}-${arch}` : null;
    const platformAliases =
      process.platform === "darwin"
        ? ["mac", "darwin"]
        : process.platform === "win32"
          ? ["windows", "win32"]
          : process.platform === "linux"
            ? ["linux"]
            : [];
    const targetCandidates = canonicalTarget
      ? [canonicalTarget, ...platformAliases.map((p) => `${p}-${arch}`)]
      : [];

    bundledCandidates.push(
      ...targetCandidates.flatMap((targetKey) => [
        resolve(process.resourcesPath, "node", targetKey, "bin", binaryName),
        resolve(process.resourcesPath, "node", targetKey, binaryName),
      ]),
      resolve(process.resourcesPath, "node", "bin", binaryName),
      resolve(process.resourcesPath, "node", "bin", "node"),
      resolve(process.resourcesPath, "node", "bin", "node.exe"),
      resolve(process.resourcesPath, "node", binaryName),
      resolve(process.resourcesPath, "node"),
    );
  }

  try {
    const which = spawnSync("/usr/bin/which", ["node"], { encoding: "utf-8" });
    discoveredCandidates.push(which.stdout?.trim() || null);
  } catch {
    // ignore
  }

  try {
    const shell = process.env.SHELL?.trim() || "/bin/zsh";
    const resolved = spawnSync(shell, ["-lc", "command -v node"], { encoding: "utf-8" });
    discoveredCandidates.push(resolved.stdout?.trim() || null);
  } catch {
    // ignore
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(":")
    .map((dir) => dir.trim())
    .filter(Boolean);
  const preferredPathEntries = pathEntries.filter(
    (dir) =>
      dir.includes("/.nvm/versions/node/") ||
      dir.includes("/opt/homebrew/opt/node@22/") ||
      dir.includes("/node@22/"),
  );
  const fallbackPathEntries = pathEntries.filter((dir) => !preferredPathEntries.includes(dir));
  const preferredPathCandidates = preferredPathEntries.map((dir) => resolve(dir, "node"));
  const pathEnvCandidates = fallbackPathEntries.map((dir) => resolve(dir, "node"));

  const commonCandidates = [
    "/opt/homebrew/bin/node",
    "/opt/homebrew/opt/node@22/bin/node",
    "/usr/local/bin/node",
    "/usr/bin/node",
  ];

  const candidates = uniqueExistingPaths([
    ...envCandidates,
    ...bundledCandidates,
    ...preferredPathCandidates,
    ...commonCandidates,
    ...discoveredCandidates,
    ...pathEnvCandidates,
  ]);

  return candidates[0] ?? null;
}

export function resolveCliInvocation(
  cliPath: string,
  args: string[],
  options?: { includeBundledNode?: boolean },
): CliInvocation | null {
  const isMjs = cliPath.endsWith(".mjs");
  if (!isMjs) {
    return { command: cliPath, args, isMjs };
  }

  const nodePath = resolveNodeBinary({ includeBundled: options?.includeBundledNode ?? true });
  if (!nodePath) {
    return null;
  }

  return { command: nodePath, args: [cliPath, ...args], isMjs, nodePath };
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
}): void {
  const commandArgs = params.args ?? [];

  if (process.platform === "win32") {
    const target = [`"${params.command}"`, ...commandArgs.map((arg) => `"${arg}"`), "%*"].join(" ");
    writeFileSync(params.shimPath, `@echo off\r\n${target}\r\n`, "utf-8");
    return;
  }

  const execLine = `exec ${[params.command, ...commandArgs].map((value) => escapePosixSingleQuoted(value)).join(" ")} "$@"`;
  writeFileSync(params.shimPath, `#!/bin/sh\n${execLine}\n`, { encoding: "utf-8", mode: 0o755 });
  chmodSync(params.shimPath, 0o755);
}

function writeBustlyShim(params: {
  shimDir: string;
  runtimeNodePath: string;
  bustlyScriptPath: string;
}): void {
  const bustlyShimPath = resolve(params.shimDir, process.platform === "win32" ? "bustly.cmd" : "bustly");
  writeCommandShim({
    shimPath: bustlyShimPath,
    command: params.runtimeNodePath,
    args: [params.bustlyScriptPath],
  });
}

export function ensureBundledOpenClawShim(
  cliPath: string,
  stateDir: string,
  options?: BundledCliShimOptions,
): CliShim | null {
  const invocation = resolveCliInvocation(cliPath, [], options);
  if (!invocation) {
    return null;
  }

  const shimDir = resolve(stateDir, "electron", "bin");
  const shimPath = resolve(shimDir, process.platform === "win32" ? "openclaw.cmd" : "openclaw");
  mkdirSync(shimDir, { recursive: true, mode: 0o755 });

  if (process.platform === "win32") {
    const target =
      invocation.isMjs && invocation.nodePath
        ? `"${invocation.nodePath}" "${cliPath}" %*`
        : `"${cliPath}" %*`;
    writeFileSync(shimPath, `@echo off\r\n${target}\r\n`, "utf-8");
  } else {
    const execLine =
      invocation.isMjs && invocation.nodePath
        ? `exec ${escapePosixSingleQuoted(invocation.nodePath)} ${escapePosixSingleQuoted(cliPath)} "$@"`
        : `exec ${escapePosixSingleQuoted(cliPath)} "$@"`;
    writeFileSync(shimPath, `#!/bin/sh\n${execLine}\n`, { encoding: "utf-8", mode: 0o755 });
    chmodSync(shimPath, 0o755);
  }

  const runtimeNodePath = invocation.nodePath ?? resolveNodeBinary({ includeBundled: options?.includeBundledNode ?? true });
  const resourcesPath = options?.resourcesPath || process.resourcesPath;
  const appPath = options?.appPath;

  if (runtimeNodePath) {
    const bustlyScriptPath = resolveBustlyCliScriptPath({
      resourcesPath,
      appPath,
    });
    if (bustlyScriptPath) {
      writeBustlyShim({
        shimDir,
        runtimeNodePath,
        bustlyScriptPath,
      });
    }
  }

  return { shimDir, shimPath };
}
