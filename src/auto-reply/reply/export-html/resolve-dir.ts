import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveOpenClawPackageRootSync } from "../../../infra/openclaw-root.js";

export type ExportHtmlDirResolveOptions = {
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
  resourcesPath?: string;
};

const REQUIRED_EXPORT_HTML_FILES = [
  "template.html",
  "template.css",
  "template.js",
  path.join("vendor", "marked.min.js"),
  path.join("vendor", "highlight.min.js"),
] as const;

let cachedExportHtmlDir: string | undefined;

function looksLikeExportHtmlDir(dir: string): boolean {
  return REQUIRED_EXPORT_HTML_FILES.every((file) => fs.existsSync(path.join(dir, file)));
}

function pushCandidate(target: Set<string>, candidate?: string | null) {
  if (!candidate) {
    return;
  }
  target.add(path.resolve(candidate));
}

export function resolveExportHtmlDir(
  opts: ExportHtmlDirResolveOptions = {},
): string {
  const hasCustomOpts = Object.keys(opts).length > 0;
  if (!hasCustomOpts && cachedExportHtmlDir) {
    return cachedExportHtmlDir;
  }

  const override = process.env.OPENCLAW_EXPORT_HTML_DIR?.trim();
  const moduleUrl = opts.moduleUrl ?? import.meta.url;
  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const cwd = opts.cwd ?? process.cwd();
  const argv1 = opts.argv1 ?? process.argv[1];
  const resourcesPath = opts.resourcesPath ?? process.resourcesPath;
  const packageRoot = resolveOpenClawPackageRootSync({ moduleUrl, cwd, argv1 });
  const candidates = new Set<string>();

  pushCandidate(candidates, override);
  pushCandidate(candidates, path.join(moduleDir, "export-html"));
  pushCandidate(candidates, path.join(moduleDir, "..", "export-html"));
  pushCandidate(candidates, resourcesPath ? path.join(resourcesPath, "dist", "export-html") : null);
  pushCandidate(candidates, packageRoot ? path.join(packageRoot, "dist", "export-html") : null);
  pushCandidate(candidates, packageRoot ? path.join(packageRoot, "src", "auto-reply", "reply", "export-html") : null);
  pushCandidate(candidates, cwd ? path.join(cwd, "dist", "export-html") : null);
  pushCandidate(candidates, cwd ? path.join(cwd, "src", "auto-reply", "reply", "export-html") : null);

  // Electron dev builds bundle the command into apps/electron/dist/main
  // while the OpenClaw runtime assets may live under apps/electron/resources/openclaw.
  let current = moduleDir;
  for (let depth = 0; depth < 8; depth += 1) {
    pushCandidate(candidates, path.join(current, "dist", "export-html"));
    pushCandidate(candidates, path.join(current, "resources", "openclaw", "dist", "export-html"));
    pushCandidate(candidates, path.join(current, "src", "auto-reply", "reply", "export-html"));
    const next = path.dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  const tried = [...candidates];
  for (const candidate of tried) {
    if (!looksLikeExportHtmlDir(candidate)) {
      continue;
    }
    if (!hasCustomOpts) {
      cachedExportHtmlDir = candidate;
    }
    return candidate;
  }

  throw new Error(`Export HTML templates not found. Looked in: ${tried.join(", ")}`);
}

export function resetExportHtmlDirCache() {
  cachedExportHtmlDir = undefined;
}
