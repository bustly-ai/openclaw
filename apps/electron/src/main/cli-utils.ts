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
  const bundledCandidates: string[] = [];
  const discoveredCandidates: Array<string | null> = [];

  if (options?.includeBundled ?? true) {
    const platform = normalizePlatform(process.platform);
    const arch = normalizeArch(process.arch);
    const binaryName = process.platform === "win32" ? "node.exe" : "node";
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

  const pathEnvCandidates = (process.env.PATH ?? "")
    .split(":")
    .map((dir) => dir.trim())
    .filter(Boolean)
    .map((dir) => resolve(dir, "node"));

  const commonCandidates = [
    "/opt/homebrew/bin/node",
    "/opt/homebrew/opt/node@22/bin/node",
    "/usr/local/bin/node",
    "/usr/bin/node",
  ];

  const candidates = uniqueExistingPaths([
    ...bundledCandidates,
    ...discoveredCandidates,
    ...pathEnvCandidates,
    ...commonCandidates,
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

function resolveRuntimeScriptPath(params: {
  packageName: string;
  resourcesPath: string;
  appPath?: string;
  fallbackScriptPath?: string;
}): string | null {
  const packageParts = params.packageName.split("/").filter(Boolean);
  const bundledBustlySkillsDir = resolveBundledBustlySkillsDir({
    resourcesPath: params.resourcesPath,
    appPath: params.appPath,
  });
  const candidateRoots = [
    resolve(params.resourcesPath, "node_modules"),
    resolve(params.resourcesPath, "openclaw", "node_modules"),
    params.appPath ? resolve(params.appPath, "node_modules") : "",
    params.appPath ? resolve(params.appPath, "resources", "openclaw", "node_modules") : "",
    resolve(process.cwd(), "node_modules"),
    resolve(process.cwd(), "resources", "openclaw", "node_modules"),
    bundledBustlySkillsDir,
    resolve(process.cwd(), "..", "..", "bustly-skills", "skills"),
    resolve(__dirname, "../../../../../bustly-skills/skills"),
  ].filter((candidate) => candidate && candidate.trim().length > 0);

  const candidates: string[] = [];
  for (const root of candidateRoots) {
    if (root.endsWith("/skills") || root.endsWith("\\skills")) {
      if (params.fallbackScriptPath) {
        candidates.push(resolve(root, params.fallbackScriptPath));
      }
      continue;
    }
    candidates.push(resolve(root, ...packageParts, "scripts", "run.js"));
  }

  for (const candidate of candidates) {
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

function writeBustlyDispatcher(params: {
  shimDir: string;
  commerceShimPath: string | null;
  adsShimPath: string | null;
}): void {
  const bustlyShimPath = resolve(params.shimDir, process.platform === "win32" ? "bustly.cmd" : "bustly");

  if (process.platform === "win32") {
    const commerceCmd = params.commerceShimPath ? `"${params.commerceShimPath}"` : "";
    const adsCmd = params.adsShimPath ? `"${params.adsShimPath}"` : "";
    const content = `@echo off
setlocal
set "_skill=%~1"
if /I "%_skill%"=="ops" (
  shift
  set "_skill=%~1"
)
if "%_skill%"=="" goto :help
if /I "%_skill%"=="help" goto :help
if /I "%_skill%"=="--help" goto :help
if /I "%_skill%"=="-h" goto :help
if /I "%_skill%"=="list" goto :list

if /I "%_skill%"=="commerce" (
  shift
  ${commerceCmd ? `call ${commerceCmd} %*` : 'echo Commerce runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="commerce_core_ops" (
  shift
  ${commerceCmd ? `call ${commerceCmd} %*` : 'echo Commerce runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="ads" (
  shift
  ${adsCmd ? `call ${adsCmd} %*` : 'echo Ads runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="ads_core_ops" (
  shift
  ${adsCmd ? `call ${adsCmd} %*` : 'echo Ads runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)

echo Unknown skill: %_skill% 1>&2
exit /b 1

:list
echo commerce\tcommerce_core_ops\tbustly commerce providers
echo ads\tads_core_ops\tbustly ads platforms
exit /b 0

:help
echo Bustly Runtime CLI
echo.
echo Usage:
echo   bustly ^<skill^> ^<command^> [args...]
echo   bustly ops ^<skill^> ^<command^> [args...] ^(backward compatible^)
echo.
echo Skills:
echo   - commerce ^(commerce_core_ops^)
echo   - ads ^(ads_core_ops^)
exit /b 0
`;
    writeFileSync(bustlyShimPath, content, "utf-8");
    return;
  }

  const content = `#!/bin/sh
set -eu
if [ "\${1:-}" = "ops" ]; then
  shift
fi
skill="\${1:-}"
if [ -z "$skill" ] || [ "$skill" = "help" ] || [ "$skill" = "--help" ] || [ "$skill" = "-h" ]; then
  cat <<'EOF'
Bustly Runtime CLI

Usage:
  bustly <skill> <command> [args...]
  bustly ops <skill> <command> [args...]   # backward compatible

Skills:
  - commerce (commerce_core_ops)
  - ads (ads_core_ops)
EOF
  exit 0
fi

if [ "$skill" = "list" ]; then
  printf '%s\\n' "commerce\tcommerce_core_ops\tbustly commerce providers"
  printf '%s\\n' "ads\tads_core_ops\tbustly ads platforms"
  exit 0
fi

shift || true
case "$skill" in
  commerce|commerce_core_ops)
    ${params.commerceShimPath ? `exec ${escapePosixSingleQuoted(params.commerceShimPath)} "$@"` : 'echo "Commerce runtime not available" >&2; exit 1'}
    ;;
  ads|ads_core_ops)
    ${params.adsShimPath ? `exec ${escapePosixSingleQuoted(params.adsShimPath)} "$@"` : 'echo "Ads runtime not available" >&2; exit 1'}
    ;;
  *)
    echo "Unknown skill: $skill" >&2
    exit 1
    ;;
esac
`;
  writeFileSync(bustlyShimPath, content, { encoding: "utf-8", mode: 0o755 });
  chmodSync(bustlyShimPath, 0o755);
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
    const commerceRuntimeScript = resolveRuntimeScriptPath({
      packageName: "@bustly/skill-runtime-commerce-core-ops",
      resourcesPath,
      appPath,
      fallbackScriptPath: "commerce_core_ops/scripts/run.js",
    });
    const adsRuntimeScript = resolveRuntimeScriptPath({
      packageName: "@bustly/skill-runtime-ads-core-ops",
      resourcesPath,
      appPath,
      fallbackScriptPath: "ads_core_ops/scripts/run.js",
    });

    const commerceShimPath = commerceRuntimeScript
      ? resolve(shimDir, process.platform === "win32" ? "bustly-commerce.cmd" : "bustly-commerce")
      : null;
    if (commerceShimPath && commerceRuntimeScript) {
      writeCommandShim({
        shimPath: commerceShimPath,
        command: runtimeNodePath,
        args: [commerceRuntimeScript],
      });
      writeCommandShim({
        shimPath: resolve(shimDir, process.platform === "win32" ? "bustly-skill-commerce.cmd" : "bustly-skill-commerce"),
        command: runtimeNodePath,
        args: [commerceRuntimeScript],
      });
    }

    const adsShimPath = adsRuntimeScript
      ? resolve(shimDir, process.platform === "win32" ? "bustly-ads.cmd" : "bustly-ads")
      : null;
    if (adsShimPath && adsRuntimeScript) {
      writeCommandShim({
        shimPath: adsShimPath,
        command: runtimeNodePath,
        args: [adsRuntimeScript],
      });
      writeCommandShim({
        shimPath: resolve(shimDir, process.platform === "win32" ? "bustly-skill-ads.cmd" : "bustly-skill-ads"),
        command: runtimeNodePath,
        args: [adsRuntimeScript],
      });
    }

    if (commerceShimPath || adsShimPath) {
      writeBustlyDispatcher({
        shimDir,
        commerceShimPath,
        adsShimPath,
      });
    }
  }

  return { shimDir, shimPath };
}
