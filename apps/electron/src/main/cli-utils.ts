import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

function resolveExecutableBinary(binary: string, params: {
  resourcesPath: string;
  appPath?: string;
}): string | null {
  const executableName = process.platform === "win32" ? `${binary}.cmd` : binary;
  const candidateDirs = [
    resolve(params.resourcesPath, "node_modules", ".bin"),
    resolve(params.resourcesPath, "openclaw", "node_modules", ".bin"),
    params.appPath ? resolve(params.appPath, "node_modules", ".bin") : "",
    params.appPath ? resolve(params.appPath, "..", "resources", "openclaw", "node_modules", ".bin") : "",
    resolve(process.cwd(), "node_modules", ".bin"),
    resolve(process.cwd(), "resources", "openclaw", "node_modules", ".bin"),
    resolve(process.cwd(), "..", "resources", "openclaw", "node_modules", ".bin"),
    resolve(process.cwd(), "..", "bustly-skills", "node_modules", ".bin"),
  ].filter((candidate) => candidate && candidate.trim().length > 0);

  const shellResolved: Array<string | null> = [];
  try {
    const which = spawnSync("/usr/bin/which", [binary], { encoding: "utf-8" });
    shellResolved.push(which.stdout?.trim() || null);
  } catch {
    // ignore
  }

  try {
    const shell = process.env.SHELL?.trim() || "/bin/zsh";
    const resolved = spawnSync(shell, ["-lc", `command -v ${binary}`], { encoding: "utf-8" });
    shellResolved.push(resolved.stdout?.trim() || null);
  } catch {
    // ignore
  }

  const candidates = uniqueExistingPaths([
    ...candidateDirs.map((dir) => resolve(dir, executableName)),
    ...shellResolved,
  ]);
  return candidates[0] ?? null;
}

function resolveRuntimePackageScript(packageName: string, params: {
  resourcesPath: string;
  appPath?: string;
}): string | null {
  const packageParts = packageName.split("/").filter(Boolean);
  const candidateRoots = [
    resolve(params.resourcesPath, "node_modules"),
    resolve(params.resourcesPath, "openclaw", "node_modules"),
    params.appPath ? resolve(params.appPath, "node_modules") : "",
    params.appPath ? resolve(params.appPath, "..", "resources", "openclaw", "node_modules") : "",
    resolve(process.cwd(), "node_modules"),
    resolve(process.cwd(), "resources", "openclaw", "node_modules"),
    resolve(process.cwd(), "..", "resources", "openclaw", "node_modules"),
  ].filter((candidate) => candidate && candidate.trim().length > 0);

  const candidates = candidateRoots.map((root) => resolve(root, ...packageParts, "scripts", "run.js"));
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

function removeCommandShims(paths: string[]): void {
  for (const shimPath of paths) {
    try {
      if (existsSync(shimPath)) {
        rmSync(shimPath, { force: true });
      }
    } catch {
      // best effort cleanup
    }
  }
}

function writeBustlyDispatcher(params: {
  shimDir: string;
  commerceShimPath: string | null;
  adsShimPath: string | null;
  minimaxTtsShimPath: string | null;
  nanoBananaShimPath: string | null;
  sourceProductShimPath: string | null;
}): void {
  const bustlyShimPath = resolve(params.shimDir, process.platform === "win32" ? "bustly.cmd" : "bustly");

  if (process.platform === "win32") {
    const commerceCmd = params.commerceShimPath ? `"${params.commerceShimPath}"` : "";
    const adsCmd = params.adsShimPath ? `"${params.adsShimPath}"` : "";
    const minimaxTtsCmd = params.minimaxTtsShimPath ? `"${params.minimaxTtsShimPath}"` : "";
    const nanoBananaCmd = params.nanoBananaShimPath ? `"${params.nanoBananaShimPath}"` : "";
    const sourceProductCmd = params.sourceProductShimPath ? `"${params.sourceProductShimPath}"` : "";
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
if /I "%_skill%"=="minimax-tts" (
  shift
  ${minimaxTtsCmd ? `call ${minimaxTtsCmd} %*` : 'echo MiniMax TTS runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="minimax_tts" (
  shift
  ${minimaxTtsCmd ? `call ${minimaxTtsCmd} %*` : 'echo MiniMax TTS runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="tts" (
  shift
  ${minimaxTtsCmd ? `call ${minimaxTtsCmd} %*` : 'echo MiniMax TTS runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="nano-banana-pro" (
  shift
  ${nanoBananaCmd ? `call ${nanoBananaCmd} %*` : 'echo Nano Banana runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="nano_banana_pro" (
  shift
  ${nanoBananaCmd ? `call ${nanoBananaCmd} %*` : 'echo Nano Banana runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="nano-banana" (
  shift
  ${nanoBananaCmd ? `call ${nanoBananaCmd} %*` : 'echo Nano Banana runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="source-product" (
  shift
  ${sourceProductCmd ? `call ${sourceProductCmd} %*` : 'echo Source Product runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="source_product" (
  shift
  ${sourceProductCmd ? `call ${sourceProductCmd} %*` : 'echo Source Product runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)
if /I "%_skill%"=="source" (
  shift
  ${sourceProductCmd ? `call ${sourceProductCmd} %*` : 'echo Source Product runtime not available 1>&2 & exit /b 1'}
  exit /b %errorlevel%
)

echo Unknown skill: %_skill% 1>&2
exit /b 1

:list
echo commerce\tcommerce_core_ops\tbustly commerce providers
echo ads\tads_core_ops\tbustly ads platforms
echo minimax-tts\tminimax_tts\tbustly minimax-tts --help
echo nano-banana-pro\tnano_banana_pro\tbustly nano-banana-pro --help
echo source-product\tsource_product\tbustly source-product help
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
echo   - minimax-tts ^(minimax_tts^)
echo   - nano-banana-pro ^(nano_banana_pro^)
echo   - source-product ^(source_product^)
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
  - minimax-tts (minimax_tts)
  - nano-banana-pro (nano_banana_pro)
  - source-product (source_product)
EOF
  exit 0
fi

if [ "$skill" = "list" ]; then
  printf '%s\\n' "commerce\tcommerce_core_ops\tbustly commerce providers"
  printf '%s\\n' "ads\tads_core_ops\tbustly ads platforms"
  printf '%s\\n' "minimax-tts\tminimax_tts\tbustly minimax-tts --help"
  printf '%s\\n' "nano-banana-pro\tnano_banana_pro\tbustly nano-banana-pro --help"
  printf '%s\\n' "source-product\tsource_product\tbustly source-product help"
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
  minimax-tts|minimax_tts|tts)
    ${params.minimaxTtsShimPath ? `exec ${escapePosixSingleQuoted(params.minimaxTtsShimPath)} "$@"` : 'echo "MiniMax TTS runtime not available" >&2; exit 1'}
    ;;
  nano-banana-pro|nano_banana_pro|nano-banana)
    ${params.nanoBananaShimPath ? `exec ${escapePosixSingleQuoted(params.nanoBananaShimPath)} "$@"` : 'echo "Nano Banana runtime not available" >&2; exit 1'}
    ;;
  source-product|source_product|source)
    ${params.sourceProductShimPath ? `exec ${escapePosixSingleQuoted(params.sourceProductShimPath)} "$@"` : 'echo "Source Product runtime not available" >&2; exit 1'}
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

  const resourcesPath = options?.resourcesPath || process.resourcesPath;
  const appPath = options?.appPath;
  const runtimeNodePath = invocation.nodePath ?? resolveNodeBinary({ includeBundled: options?.includeBundledNode ?? true });
  const commerceBinary = resolveExecutableBinary("bustly-commerce", { resourcesPath, appPath });
  const adsBinary = resolveExecutableBinary("bustly-ads", { resourcesPath, appPath });
  const minimaxTtsBinary = resolveExecutableBinary("bustly-minimax-tts", { resourcesPath, appPath });
  const nanoBananaBinary = resolveExecutableBinary("bustly-nano-banana-pro", { resourcesPath, appPath });
  const sourceProductBinary = resolveExecutableBinary("bustly-source-product", { resourcesPath, appPath });
  const commerceScript = runtimeNodePath
    ? resolveRuntimePackageScript("@bustly/skill-runtime-commerce-core-ops", { resourcesPath, appPath })
    : null;
  const adsScript = runtimeNodePath
    ? resolveRuntimePackageScript("@bustly/skill-runtime-ads-core-ops", { resourcesPath, appPath })
    : null;
  const minimaxTtsScript = runtimeNodePath
    ? resolveRuntimePackageScript("@bustly/skill-runtime-minimax-tts", { resourcesPath, appPath })
    : null;
  const nanoBananaScript = runtimeNodePath
    ? resolveRuntimePackageScript("@bustly/skill-runtime-nano-banana-pro", { resourcesPath, appPath })
    : null;
  const sourceProductScript = runtimeNodePath
    ? resolveRuntimePackageScript("@bustly/skill-runtime-source-product", { resourcesPath, appPath })
    : null;

  const commerceCommand = commerceBinary
    ? { command: commerceBinary, args: [] as string[] }
    : runtimeNodePath && commerceScript
      ? { command: runtimeNodePath, args: [commerceScript] as string[] }
      : null;
  const adsCommand = adsBinary
    ? { command: adsBinary, args: [] as string[] }
    : runtimeNodePath && adsScript
      ? { command: runtimeNodePath, args: [adsScript] as string[] }
      : null;
  const minimaxTtsCommand = minimaxTtsBinary
    ? { command: minimaxTtsBinary, args: [] as string[] }
    : runtimeNodePath && minimaxTtsScript
      ? { command: runtimeNodePath, args: [minimaxTtsScript] as string[] }
      : null;
  const nanoBananaCommand = nanoBananaBinary
    ? { command: nanoBananaBinary, args: [] as string[] }
    : runtimeNodePath && nanoBananaScript
      ? { command: runtimeNodePath, args: [nanoBananaScript] as string[] }
      : null;
  const sourceProductCommand = sourceProductBinary
    ? { command: sourceProductBinary, args: [] as string[] }
    : runtimeNodePath && sourceProductScript
      ? { command: runtimeNodePath, args: [sourceProductScript] as string[] }
      : null;

  const commerceShimPath = commerceCommand
    ? resolve(shimDir, process.platform === "win32" ? "bustly-commerce.cmd" : "bustly-commerce")
    : null;
  const commerceAliasShimPath = resolve(
    shimDir,
    process.platform === "win32" ? "bustly-skill-commerce.cmd" : "bustly-skill-commerce",
  );
  if (commerceShimPath && commerceCommand) {
    writeCommandShim({
      shimPath: commerceShimPath,
      command: commerceCommand.command,
      args: commerceCommand.args,
    });
    writeCommandShim({
      shimPath: commerceAliasShimPath,
      command: commerceCommand.command,
      args: commerceCommand.args,
    });
  } else {
    removeCommandShims([
      resolve(shimDir, process.platform === "win32" ? "bustly-commerce.cmd" : "bustly-commerce"),
      commerceAliasShimPath,
    ]);
  }

  const adsShimPath = adsCommand
    ? resolve(shimDir, process.platform === "win32" ? "bustly-ads.cmd" : "bustly-ads")
    : null;
  const adsAliasShimPath = resolve(
    shimDir,
    process.platform === "win32" ? "bustly-skill-ads.cmd" : "bustly-skill-ads",
  );
  if (adsShimPath && adsCommand) {
    writeCommandShim({
      shimPath: adsShimPath,
      command: adsCommand.command,
      args: adsCommand.args,
    });
    writeCommandShim({
      shimPath: adsAliasShimPath,
      command: adsCommand.command,
      args: adsCommand.args,
    });
  } else {
    removeCommandShims([
      resolve(shimDir, process.platform === "win32" ? "bustly-ads.cmd" : "bustly-ads"),
      adsAliasShimPath,
    ]);
  }

  const minimaxTtsShimPath = minimaxTtsCommand
    ? resolve(shimDir, process.platform === "win32" ? "bustly-minimax-tts.cmd" : "bustly-minimax-tts")
    : null;
  const minimaxAliasShimPath = resolve(
    shimDir,
    process.platform === "win32" ? "bustly-skill-minimax-tts.cmd" : "bustly-skill-minimax-tts",
  );
  if (minimaxTtsShimPath && minimaxTtsCommand) {
    writeCommandShim({
      shimPath: minimaxTtsShimPath,
      command: minimaxTtsCommand.command,
      args: minimaxTtsCommand.args,
    });
    writeCommandShim({
      shimPath: minimaxAliasShimPath,
      command: minimaxTtsCommand.command,
      args: minimaxTtsCommand.args,
    });
  } else {
    removeCommandShims([
      resolve(
        shimDir,
        process.platform === "win32" ? "bustly-minimax-tts.cmd" : "bustly-minimax-tts",
      ),
      minimaxAliasShimPath,
    ]);
  }

  const nanoBananaShimPath = nanoBananaCommand
    ? resolve(shimDir, process.platform === "win32" ? "bustly-nano-banana-pro.cmd" : "bustly-nano-banana-pro")
    : null;
  const nanoBananaAliasShimPath = resolve(
    shimDir,
    process.platform === "win32"
      ? "bustly-skill-nano-banana-pro.cmd"
      : "bustly-skill-nano-banana-pro",
  );
  if (nanoBananaShimPath && nanoBananaCommand) {
    writeCommandShim({
      shimPath: nanoBananaShimPath,
      command: nanoBananaCommand.command,
      args: nanoBananaCommand.args,
    });
    writeCommandShim({
      shimPath: nanoBananaAliasShimPath,
      command: nanoBananaCommand.command,
      args: nanoBananaCommand.args,
    });
  } else {
    removeCommandShims([
      resolve(
        shimDir,
        process.platform === "win32" ? "bustly-nano-banana-pro.cmd" : "bustly-nano-banana-pro",
      ),
      nanoBananaAliasShimPath,
    ]);
  }

  const sourceProductShimPath = sourceProductCommand
    ? resolve(shimDir, process.platform === "win32" ? "bustly-source-product.cmd" : "bustly-source-product")
    : null;
  const sourceAliasShimPath = resolve(
    shimDir,
    process.platform === "win32"
      ? "bustly-skill-source-product.cmd"
      : "bustly-skill-source-product",
  );
  if (sourceProductShimPath && sourceProductCommand) {
    writeCommandShim({
      shimPath: sourceProductShimPath,
      command: sourceProductCommand.command,
      args: sourceProductCommand.args,
    });
    writeCommandShim({
      shimPath: sourceAliasShimPath,
      command: sourceProductCommand.command,
      args: sourceProductCommand.args,
    });
  } else {
    removeCommandShims([
      resolve(
        shimDir,
        process.platform === "win32" ? "bustly-source-product.cmd" : "bustly-source-product",
      ),
      sourceAliasShimPath,
    ]);
  }

  if (commerceShimPath || adsShimPath || minimaxTtsShimPath || nanoBananaShimPath || sourceProductShimPath) {
    writeBustlyDispatcher({
      shimDir,
      commerceShimPath,
      adsShimPath,
      minimaxTtsShimPath,
      nanoBananaShimPath,
      sourceProductShimPath,
    });
  }

  return { shimDir, shimPath };
}
