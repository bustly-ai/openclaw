import fs from "node:fs/promises";
import path from "node:path";
import { resolveActiveBustlyWorkspaceBinding } from "./workspace-runtime.js";

type ImportParams = {
  name?: string;
  relativePath?: string | null;
  contentBase64: string;
};

type ImportResult = {
  path: string;
  name: string;
  kind: "file";
};

function sanitizeRelativePath(name?: string, relativePath?: string | null): string {
  const fallbackName = path.basename((name || "").trim()) || "upload.bin";
  const raw = (relativePath || name || "").trim().replaceAll("\\", "/");
  if (!raw) {
    return fallbackName;
  }
  const normalized = raw.replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    return fallbackName;
  }
  const last = parts.at(-1);
  if (!last) {
    return fallbackName;
  }
  parts[parts.length - 1] = path.basename(last) || fallbackName;
  return parts.join("/");
}

async function resolveUniqueImportPath(rootDir: string, relativePath: string): Promise<string> {
  const parsed = path.parse(relativePath);
  const safeDir = parsed.dir ? parsed.dir : "";
  const baseName = parsed.name || "upload";
  const ext = parsed.ext || "";
  let attempt = 0;
  while (true) {
    const candidateName = attempt === 0 ? `${baseName}${ext}` : `${baseName}-${attempt + 1}${ext}`;
    const candidatePath = path.join(rootDir, safeDir, candidateName);
    try {
      await fs.access(candidatePath);
      attempt += 1;
    } catch {
      return candidatePath;
    }
  }
}

export async function importBustlyPathFile(params: ImportParams): Promise<ImportResult> {
  const active = resolveActiveBustlyWorkspaceBinding();
  if (!active?.workspaceDir) {
    throw new Error("No active Bustly workspace is available for file import.");
  }
  const uploadRoot = path.join(active.workspaceDir, ".uploads");
  const safeRelativePath = sanitizeRelativePath(params.name, params.relativePath);
  const targetPath = await resolveUniqueImportPath(uploadRoot, safeRelativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(params.contentBase64, "base64"));
  return {
    path: targetPath,
    name: path.basename(targetPath),
    kind: "file",
  };
}
