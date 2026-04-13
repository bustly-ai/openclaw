import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveOpenClawPackageRoot } from "../infra/openclaw-root.js";
import { pathExists } from "../utils.js";

const FALLBACK_TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/reference/templates",
);

let cachedTemplateDir: string | undefined;
let resolvingTemplateDir: Promise<string> | undefined;

function readProcessResourcesPath(): string | undefined {
  const maybeProcess = process as NodeJS.Process & { resourcesPath?: unknown };
  return typeof maybeProcess.resourcesPath === "string"
    ? maybeProcess.resourcesPath
    : undefined;
}

async function looksLikeWorkspaceTemplateDir(dir: string): Promise<boolean> {
  return await pathExists(path.join(dir, "AGENTS.md"));
}

export async function resolveWorkspaceTemplateDir(opts?: {
  cwd?: string;
  argv1?: string;
  moduleUrl?: string;
  resourcesPath?: string;
}): Promise<string> {
  if (cachedTemplateDir) {
    return cachedTemplateDir;
  }
  if (resolvingTemplateDir) {
    return resolvingTemplateDir;
  }

  resolvingTemplateDir = (async () => {
    const moduleUrl = opts?.moduleUrl ?? import.meta.url;
    const argv1 = opts?.argv1 ?? process.argv[1];
    const cwd = opts?.cwd ?? process.cwd();
    const resourcesPath = opts?.resourcesPath ?? readProcessResourcesPath();
    const argv1Dir = argv1 ? path.dirname(path.resolve(argv1)) : null;
    const moduleDir = path.dirname(fileURLToPath(moduleUrl));

    const packageRoot = await resolveOpenClawPackageRoot({ moduleUrl, argv1, cwd });
    const candidates = [
      resourcesPath ? path.join(resourcesPath, "docs", "reference", "templates") : null,
      // Packaged/electron runtime: openclaw.mjs is placed under Resources/.
      argv1Dir ? path.join(argv1Dir, "docs", "reference", "templates") : null,
      packageRoot ? path.join(packageRoot, "docs", "reference", "templates") : null,
      cwd ? path.resolve(cwd, "docs", "reference", "templates") : null,
      FALLBACK_TEMPLATE_DIR,
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (await looksLikeWorkspaceTemplateDir(candidate)) {
        cachedTemplateDir = candidate;
        return candidate;
      }
    }

    // Best-effort ancestor walk for packaged runtimes where argv[1] can be absent
    // or rewritten and the templates live next to the bundled runtime assets.
    let current = moduleDir;
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(current, "docs", "reference", "templates");
      if (await looksLikeWorkspaceTemplateDir(candidate)) {
        cachedTemplateDir = candidate;
        return candidate;
      }
      const next = path.dirname(current);
      if (next === current) {
        break;
      }
      current = next;
    }

    cachedTemplateDir = candidates[0] ?? FALLBACK_TEMPLATE_DIR;
    return cachedTemplateDir;
  })();

  try {
    return await resolvingTemplateDir;
  } finally {
    resolvingTemplateDir = undefined;
  }
}

export function resetWorkspaceTemplateDirCache() {
  cachedTemplateDir = undefined;
  resolvingTemplateDir = undefined;
}
