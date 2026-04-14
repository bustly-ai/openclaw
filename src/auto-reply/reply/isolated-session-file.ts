import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function buildIsolatedInternalSessionId(
  sourceSessionId: string,
  label: string,
  runId: string,
): string {
  const base = sourceSessionId.trim() || "session";
  const suffix = label.trim() || "internal";
  const unique = runId.trim() || "run";
  return `${base}__${suffix}__${unique}`;
}

export async function withIsolatedSessionFile<T>(
  sourceSessionFile: string,
  label: string,
  run: (sessionFile: string) => Promise<T>,
): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), `openclaw-${label}-`));
  const isolatedSessionFile = path.join(tempDir, path.basename(sourceSessionFile) || "session.jsonl");
  try {
    try {
      await fs.copyFile(sourceSessionFile, isolatedSessionFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      await fs.writeFile(isolatedSessionFile, "", "utf-8");
    }
    return await run(isolatedSessionFile);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
