#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = resolve(__dirname, "..");

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) {return null;}
  return args[idx + 1] ?? null;
};

const normalizePlatform = (value) => {
  if (!value) {return null;}
  const v = value.toLowerCase();
  if (v === "mac" || v === "darwin" || v === "macos") {return "mac";}
  if (v === "win" || v === "windows" || v === "win32") {return "windows";}
  if (v === "linux") {return "linux";}
  return null;
};

const normalizeArch = (value) => {
  if (!value) {return null;}
  const v = value.toLowerCase();
  if (v === "x64" || v === "amd64") {return "x64";}
  if (v === "arm64" || v === "aarch64") {return "arm64";}
  if (v === "universal") {return "universal";}
  return null;
};

const platform = normalizePlatform(getArg("--platform") || process.platform);
const arch = normalizeArch(getArg("--arch") || (platform === "mac" ? process.arch : null));
const target = getArg("--target");
const envFile = getArg("--env-file") || ".env.production";
const shouldNotarize = platform === "mac" && !args.includes("--skip-notarize");
const useNullMacIdentity = args.includes("--mac-identity-null");

if (!platform) {
  console.error("[build-release] Unknown platform. Use --platform mac|windows|linux.");
  process.exit(1);
}

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
const packagedEnvPath = resolve(appDir, ".env");
const selectedEnvPath = resolve(appDir, envFile);

if (!existsSync(selectedEnvPath)) {
  console.error(`[build-release] Env file not found: ${selectedEnvPath}`);
  process.exit(1);
}

const run = (cmd, cmdArgs, opts = {}) => {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    cwd: appDir,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    const error = new Error(`[build-release] Command failed: ${cmd} ${cmdArgs.join(" ")}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
};

const capture = (cmd, cmdArgs, opts = {}) => {
  const result = spawnSync(cmd, cmdArgs, {
    encoding: "utf-8",
    cwd: appDir,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    const error = new Error(`[build-release] Command failed: ${cmd} ${cmdArgs.join(" ")}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
  return (result.stdout || "").trim();
};

const originalEnvExists = existsSync(packagedEnvPath);
const originalEnvContent = originalEnvExists ? readFileSync(packagedEnvPath) : null;

let exitCode = 0;

try {
  copyFileSync(selectedEnvPath, packagedEnvPath);

  run(pnpmCmd, ["run", "prepare:openclaw-deps"]);

  run(pnpmCmd, ["run", "build"]);

  const updatePlatformKey =
    platform === "mac"
      ? `mac-${arch === "x64" || arch === "arm64" ? arch : "arm64"}`
      : platform === "windows"
        ? "windows"
        : "linux";

  const publishUrl = capture(nodeCmd, ["scripts/resolve-publish-url.js"], {
    env: {
      ...process.env,
      BUSTLY_UPDATE_PLATFORM: updatePlatformKey,
    },
  });

  let outputDir = "dist/electron";
  if (platform === "mac") {
    const resolvedArch = arch === "arm64" || arch === "x64" ? arch : "arm64";
    outputDir = `dist/electron/mac-${resolvedArch}`;
  } else if (platform === "windows") {
    outputDir = "dist/electron/windows";
  } else if (platform === "linux") {
    outputDir = "dist/electron/linux";
  }

  const builderArgs = [];
  if (platform === "mac") {
    builderArgs.push("--mac");
    if (target) {builderArgs.push(target);}
    if (arch === "x64") {builderArgs.push("--x64");}
    if (arch === "arm64") {builderArgs.push("--arm64");}
    if (arch === "universal") {builderArgs.push("--universal");}
    if (useNullMacIdentity) {builderArgs.push("-c.mac.identity=null");}
  }
  if (platform === "windows") {builderArgs.push("--win");}
  if (platform === "linux") {builderArgs.push("--linux");}

  builderArgs.push(
    "--publish=always",
    "-c.publish.provider=generic",
    `-c.publish.url=${publishUrl}`,
    `-c.directories.output=${outputDir}`,
  );

  run(pnpmCmd, ["dlx", "electron-builder", ...builderArgs]);

  if (shouldNotarize) {
    run(nodeCmd, ["scripts/notarize-mac-artifacts.js", "--dir", outputDir]);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  exitCode =
    typeof error === "object" && error !== null && "exitCode" in error
      ? Number(error.exitCode) || 1
      : 1;
} finally {
  if (originalEnvExists && originalEnvContent) {
    writeFileSync(packagedEnvPath, originalEnvContent);
  } else if (!originalEnvExists && existsSync(packagedEnvPath)) {
    unlinkSync(packagedEnvPath);
  }
}

if (exitCode !== 0) {
  process.exit(exitCode);
}
