import fs from "node:fs/promises";
import path from "node:path";
import { detectMime, kindFromMime } from "../media/mime.js";

const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Za-z]:[\\/]/;

export type BustlyPathAccessMediaKind = "image" | "video" | "audio" | "document";

export type BustlyPathAccessDescriptor =
  | {
      kind: "file";
      path: string;
      realPath: string;
      name: string;
      mimeType: string | null;
      mediaKind: BustlyPathAccessMediaKind | null;
    }
  | {
      kind: "directory";
      path: string;
      realPath: string;
      name: string;
    }
  | {
      kind: "missing" | "forbidden";
      path: string;
      name: string;
    };

function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) || WINDOWS_ABSOLUTE_PATH_RE.test(value);
}

function toMediaKind(mimeType: string | undefined): BustlyPathAccessMediaKind | null {
  switch (kindFromMime(mimeType)) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "document":
      return "document";
    default:
      return null;
  }
}

export async function resolveBustlyPathAccess(pathInput: string): Promise<BustlyPathAccessDescriptor> {
  const targetPath = typeof pathInput === "string" ? pathInput.trim() : "";
  const name = path.basename(targetPath || "artifact");
  if (!targetPath || !isAbsolutePath(targetPath)) {
    return { kind: "forbidden", path: targetPath, name };
  }

  let realPath: string;
  try {
    realPath = await fs.realpath(targetPath);
  } catch {
    return { kind: "missing", path: targetPath, name };
  }

  let stat;
  try {
    stat = await fs.stat(realPath);
  } catch {
    return { kind: "missing", path: targetPath, name };
  }

  if (stat.isDirectory()) {
    return {
      kind: "directory",
      path: targetPath,
      realPath,
      name: path.basename(realPath),
    };
  }

  if (!stat.isFile()) {
    return { kind: "forbidden", path: targetPath, name };
  }

  const mimeType = (await detectMime({ filePath: realPath })) ?? null;
  return {
    kind: "file",
    path: targetPath,
    realPath,
    name: path.basename(realPath),
    mimeType,
    mediaKind: toMediaKind(mimeType ?? undefined),
  };
}
