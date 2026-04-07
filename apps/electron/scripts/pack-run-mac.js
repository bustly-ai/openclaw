#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const appDir = resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) {
    return null;
  }
  return args[idx + 1] ?? null;
};
const hasFlag = (name) => args.includes(name);

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(resolve(appDir, ".env"));

const updateUrl = process.env.BUSTLY_UPDATE_URL || process.env.BUSTLY_UPDATE_BASE_URL;

if (!updateUrl) {
  console.error("Set BUSTLY_UPDATE_URL or BUSTLY_UPDATE_BASE_URL before running pack:run:mac.");
  process.exit(1);
}

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: appDir, ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const arch = process.arch === "arm64" ? "arm64" : "x64";
const shouldSign = hasFlag("--sign");
const identityOverride = getArg("--identity");
const disableTimestamp = hasFlag("--no-timestamp");

run(pnpmCmd, ["run", "build"]);
const builderArgs = [
  "dlx",
  "electron-builder",
  "--mac",
  "dir",
  `--${arch}`,
  "-c.directories.output=dist/electron-local",
];

if (shouldSign) {
  if (identityOverride) {
    builderArgs.push(`-c.mac.identity=${identityOverride}`);
  }
  if (disableTimestamp) {
    console.warn("Signing with mac.timestamp=none for local update testing (not for release builds).");
    builderArgs.push("-c.mac.timestamp=none");
  }
} else {
  builderArgs.push("-c.mac.identity=null");
}

run(pnpmCmd, builderArgs);

const findApp = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return full;
    }
    if (entry.isDirectory()) {
      const nested = findApp(full);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
};

const appPath = findApp(resolve(appDir, "dist", "electron-local"));
if (!appPath) {
  console.error("Bustly.app not found in dist/electron-local.");
  process.exit(1);
}

const appUpdatePath = join(appPath, "Contents", "Resources", "app-update.yml");
const normalized = updateUrl.endsWith("/") ? updateUrl : `${updateUrl}/`;
const yaml = `provider: generic\nurl: ${normalized}\n`;
writeFileSync(appUpdatePath, yaml, "utf8");

execFileSync("open", [appPath], { stdio: "inherit" });
