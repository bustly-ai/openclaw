import fs from "node:fs";
import path from "node:path";
import { mergePathPrepend, normalizePathPrepend } from "../infra/path-prepend.js";
import { resolveOpenClawPackageRootSync } from "../infra/openclaw-root.js";

export type GatewayRuntimeEnvOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  argv1?: string;
  moduleUrl?: string;
  resourcesPath?: string;
  appPath?: string;
  bundledSkillsDir?: string;
  bundledPluginsDir?: string;
  bundledVersion?: string;
  stateDir?: string;
  configPath?: string;
  profile?: string;
  logFile?: string;
  preferBundledPlugins?: boolean;
  oauthCallbackPort?: number;
  pathPrepend?: Array<string | null | undefined>;
  execPathPrepend?: Array<string | null | undefined>;
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

function looksLikeSkillsDir(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".md")) {
        return true;
      }
      if (entry.isDirectory() && fs.existsSync(path.join(fullPath, "SKILL.md"))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function resolvePackageRoot(options: GatewayRuntimeEnvOptions): string | undefined {
  const found = resolveOpenClawPackageRootSync({
    cwd: options.cwd ?? process.cwd(),
    argv1: options.argv1 ?? process.argv[1],
    moduleUrl: options.moduleUrl ?? import.meta.url,
  });
  return found ?? undefined;
}

export function resolveGatewayRuntimeBundledSkillsDir(
  options: GatewayRuntimeEnvOptions = {},
): string | undefined {
  const env = options.env ?? process.env;
  const explicit = options.bundledSkillsDir?.trim();
  if (explicit && looksLikeSkillsDir(explicit)) {
    return explicit;
  }

  const override = env.OPENCLAW_BUNDLED_SKILLS_DIR?.trim();
  if (override && looksLikeSkillsDir(override)) {
    return override;
  }

  const packageRoot = resolvePackageRoot(options);
  const candidates = uniqueCandidates([
    options.resourcesPath ? path.resolve(options.resourcesPath, "bustly-skills", "skills") : null,
    options.resourcesPath ? path.resolve(options.resourcesPath, "skills") : null,
    options.appPath ? path.resolve(options.appPath, "resources", "bustly-skills", "skills") : null,
    options.appPath ? path.resolve(options.appPath, "resources", "skills") : null,
    options.appPath ? path.resolve(options.appPath, "..", "resources", "bustly-skills", "skills") : null,
    options.appPath ? path.resolve(options.appPath, "..", "resources", "skills") : null,
    packageRoot ? path.resolve(packageRoot, "bustly-skills", "skills") : null,
    packageRoot ? path.resolve(packageRoot, "skills") : null,
  ]);

  for (const candidate of candidates) {
    if (looksLikeSkillsDir(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function resolveGatewayRuntimeBundledPluginsDir(
  options: GatewayRuntimeEnvOptions = {},
): string | undefined {
  const env = options.env ?? process.env;
  const explicit = options.bundledPluginsDir?.trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const override = env.OPENCLAW_BUNDLED_PLUGINS_DIR?.trim();
  if (override && fs.existsSync(override)) {
    return override;
  }

  const packageRoot = resolvePackageRoot(options);
  const candidates = uniqueCandidates([
    options.resourcesPath ? path.resolve(options.resourcesPath, "extensions") : null,
    options.appPath ? path.resolve(options.appPath, "resources", "extensions") : null,
    options.appPath ? path.resolve(options.appPath, "..", "resources", "extensions") : null,
    options.appPath ? path.resolve(options.appPath, "..", "..", "..", "extensions") : null,
    options.appPath ? path.resolve(options.appPath, "..", "..", "extensions") : null,
    options.appPath ? path.resolve(options.appPath, "..", "extensions") : null,
    packageRoot ? path.resolve(packageRoot, "extensions") : null,
  ]);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function buildGatewayRuntimeEnv(
  options: GatewayRuntimeEnvOptions = {},
): NodeJS.ProcessEnv {
  const baseEnv = {
    ...(options.env ?? process.env),
  };
  const pathPrepend = normalizePathPrepend(
    (options.pathPrepend ?? []).filter((value): value is string => typeof value === "string"),
  );
  const execPathPrepend = normalizePathPrepend(
    (options.execPathPrepend ?? []).filter((value): value is string => typeof value === "string"),
  );
  const bundledSkillsDir = resolveGatewayRuntimeBundledSkillsDir({
    ...options,
    env: baseEnv,
  });
  const bundledPluginsDir = resolveGatewayRuntimeBundledPluginsDir({
    ...options,
    env: baseEnv,
  });
  const mergedPath = mergePathPrepend(baseEnv.PATH, pathPrepend);
  const mergedExecPathPrepend = mergePathPrepend(
    baseEnv.OPENCLAW_EXEC_PATH_PREPEND,
    execPathPrepend,
  );

  return {
    ...baseEnv,
    ...(mergedPath ? { PATH: mergedPath } : {}),
    ...(mergedExecPathPrepend
      ? { OPENCLAW_EXEC_PATH_PREPEND: mergedExecPathPrepend }
      : {}),
    ...(options.profile ? { OPENCLAW_PROFILE: options.profile } : {}),
    ...(bundledPluginsDir ? { OPENCLAW_BUNDLED_PLUGINS_DIR: bundledPluginsDir } : {}),
    ...(options.preferBundledPlugins ? { OPENCLAW_PREFER_BUNDLED_PLUGINS: "1" } : {}),
    ...(bundledSkillsDir ? { OPENCLAW_BUNDLED_SKILLS_DIR: bundledSkillsDir } : {}),
    ...(options.stateDir ? { OPENCLAW_STATE_DIR: options.stateDir } : {}),
    ...(options.configPath ? { OPENCLAW_CONFIG_PATH: options.configPath } : {}),
    ...(options.logFile ? { OPENCLAW_LOG_FILE: options.logFile } : {}),
    ...(options.bundledVersion ? { OPENCLAW_BUNDLED_VERSION: options.bundledVersion } : {}),
    ...(typeof options.oauthCallbackPort === "number"
      ? { OPENCLAW_OAUTH_CALLBACK_PORT: String(options.oauthCallbackPort) }
      : {}),
  };
}
