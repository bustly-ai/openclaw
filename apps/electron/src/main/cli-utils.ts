import { existsSync } from "node:fs";
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

const MIN_OPENCLAW_NODE_MAJOR = 22;
const MIN_OPENCLAW_NODE_MINOR = 12;

function parseNodeVersion(raw: string | null | undefined): [number, number, number] | null {
  const trimmed = (raw ?? "").trim();
  const normalized = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
  const [majorRaw, minorRaw, patchRaw] = normalized.split(".");
  const major = Number.parseInt(majorRaw ?? "", 10);
  const minor = Number.parseInt(minorRaw ?? "", 10);
  const patch = Number.parseInt(patchRaw ?? "", 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }
  return [major, minor, patch];
}

function supportsOpenClawNodeVersion(version: [number, number, number] | null): boolean {
  if (!version) {
    return false;
  }
  const [major, minor] = version;
  return major > MIN_OPENCLAW_NODE_MAJOR || (major === MIN_OPENCLAW_NODE_MAJOR && minor >= MIN_OPENCLAW_NODE_MINOR);
}

function probeNodeBinaryVersion(nodePath: string): [number, number, number] | null {
  try {
    const result = spawnSync(nodePath, ["-v"], { encoding: "utf-8" });
    if (result.status !== 0) {
      return null;
    }
    return parseNodeVersion(result.stdout);
  } catch {
    return null;
  }
}

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
  const envPath = process.env.OPENCLAW_NODE_PATH?.trim();
  const bundledCandidates: string[] = [];
  const probedCandidates: Array<string | null> = [];

  if (options?.includeBundled ?? true) {
    bundledCandidates.push(
      resolve(process.resourcesPath, "node", "bin", "node"),
      resolve(process.resourcesPath, "node"),
    );
  }

  try {
    const which = spawnSync("/usr/bin/which", ["node"], { encoding: "utf-8" });
    probedCandidates.push(which.stdout?.trim() || null);
  } catch {
    // ignore
  }

  try {
    const shell = process.env.SHELL?.trim() || "/bin/zsh";
    const resolved = spawnSync(shell, ["-lc", "command -v node"], { encoding: "utf-8" });
    probedCandidates.push(resolved.stdout?.trim() || null);
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
    "/opt/homebrew/opt/node@20/bin/node",
    "/usr/local/bin/node",
    "/usr/bin/node",
  ];

  const candidates = uniqueExistingPaths([
    envPath,
    ...bundledCandidates,
    ...probedCandidates,
    ...pathEnvCandidates,
    ...commonCandidates,
  ]);

  let fallback: string | null = null;
  for (const candidate of candidates) {
    const version = probeNodeBinaryVersion(candidate);
    if (supportsOpenClawNodeVersion(version)) {
      return candidate;
    }
    if (!fallback) {
      fallback = candidate;
    }
  }

  return fallback;
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
