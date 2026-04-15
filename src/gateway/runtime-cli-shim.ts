import fs from "node:fs";
import path from "node:path";
import { resolveOpenClawPackageRootSync } from "../infra/openclaw-root.js";

export type GatewayRuntimeCliShim = {
  shimDir: string;
  openclawShimPath: string;
  bustlyShimPath?: string;
};

export type GatewayRuntimeCliShimOptions = {
  stateDir: string;
  runtimeCommand: string;
  runtimeEnv?: Record<string, string>;
  shimDir?: string;
  cliPath?: string;
  resourcesPath?: string;
  appPath?: string;
  cwd?: string;
  argv1?: string;
  moduleUrl?: string;
};

function uniqueCandidates(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function resolvePackageRoot(options: GatewayRuntimeCliShimOptions): string | undefined {
  return (
    resolveOpenClawPackageRootSync({
      cwd: options.cwd ?? process.cwd(),
      argv1: options.argv1 ?? process.argv[1],
      moduleUrl: options.moduleUrl ?? import.meta.url,
    }) ?? undefined
  );
}

export function resolveGatewayRuntimeCliPath(
  options: Omit<GatewayRuntimeCliShimOptions, "stateDir" | "runtimeCommand" | "runtimeEnv"> & {
    cliPath?: string;
  } = {},
): string | null {
  const explicit = options.cliPath?.trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const packageRoot = resolvePackageRoot({
    stateDir: "",
    runtimeCommand: "",
    ...options,
  });
  const candidates = uniqueCandidates([
    options.resourcesPath ? path.resolve(options.resourcesPath, "openclaw.mjs") : null,
    options.resourcesPath ? path.resolve(options.resourcesPath, "dist", "cli.js") : null,
    options.appPath ? path.resolve(options.appPath, "openclaw.mjs") : null,
    options.appPath ? path.resolve(options.appPath, "dist", "cli.js") : null,
    packageRoot ? path.resolve(packageRoot, "openclaw.mjs") : null,
    packageRoot ? path.resolve(packageRoot, "dist", "cli.js") : null,
  ]);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveGatewayRuntimeBustlyCliScriptPath(
  options: Omit<GatewayRuntimeCliShimOptions, "stateDir" | "runtimeCommand" | "runtimeEnv"> = {},
): string | null {
  const packageRoot = resolvePackageRoot({
    stateDir: "",
    runtimeCommand: "",
    ...options,
  });
  const candidates = uniqueCandidates([
    options.resourcesPath
      ? path.resolve(options.resourcesPath, "bustly-skills", "scripts", "bustly-ops.js")
      : null,
    options.appPath
      ? path.resolve(options.appPath, "resources", "bustly-skills", "scripts", "bustly-ops.js")
      : null,
    options.appPath
      ? path.resolve(options.appPath, "..", "resources", "bustly-skills", "scripts", "bustly-ops.js")
      : null,
    packageRoot ? path.resolve(packageRoot, "bustly-skills", "scripts", "bustly-ops.js") : null,
  ]);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function escapePosixSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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
    fs.writeFileSync(params.shimPath, `@echo off\r\n${envPrefix}${target}\r\n`, "utf-8");
    return;
  }

  const exportLines = envEntries.map(
    ([key, value]) => `export ${key}=${escapePosixSingleQuoted(value)}`,
  );
  const execLine = `exec ${[params.command, ...commandArgs].map((value) => escapePosixSingleQuoted(value)).join(" ")} "$@"`;
  fs.writeFileSync(
    params.shimPath,
    `#!/bin/sh\n${[...exportLines, execLine].join("\n")}\n`,
    { encoding: "utf-8", mode: 0o755 },
  );
  fs.chmodSync(params.shimPath, 0o755);
}

export function ensureGatewayRuntimeCliShim(
  options: GatewayRuntimeCliShimOptions,
): GatewayRuntimeCliShim | null {
  const runtimeCommand = options.runtimeCommand?.trim();
  const stateDir = options.stateDir?.trim();
  if (!runtimeCommand || !stateDir) {
    return null;
  }

  const cliPath = resolveGatewayRuntimeCliPath(options);
  if (!cliPath) {
    return null;
  }

  const shimDir = options.shimDir?.trim() || path.resolve(stateDir, "gateway", "bin");
  fs.mkdirSync(shimDir, { recursive: true, mode: 0o755 });

  const openclawShimPath = path.resolve(
    shimDir,
    process.platform === "win32" ? "openclaw.cmd" : "openclaw",
  );
  writeCommandShim({
    shimPath: openclawShimPath,
    command: runtimeCommand,
    args: [cliPath],
    env: options.runtimeEnv,
  });

  const bustlyScriptPath = resolveGatewayRuntimeBustlyCliScriptPath(options);
  let bustlyShimPath: string | undefined;
  if (bustlyScriptPath) {
    bustlyShimPath = path.resolve(
      shimDir,
      process.platform === "win32" ? "bustly.cmd" : "bustly",
    );
    writeCommandShim({
      shimPath: bustlyShimPath,
      command: runtimeCommand,
      args: [bustlyScriptPath],
      env: options.runtimeEnv,
    });
  }

  return {
    shimDir,
    openclawShimPath,
    ...(bustlyShimPath ? { bustlyShimPath } : {}),
  };
}
