import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { resolveConfigDir } from "../utils.js";

function resolveEnvProfile(env: NodeJS.ProcessEnv): string | null {
  const profile = env.OPENCLAW_ENV?.trim() || env.NODE_ENV?.trim() || "";
  return profile.length > 0 ? profile : null;
}

function buildEnvCandidates(env: NodeJS.ProcessEnv): string[] {
  const profile = resolveEnvProfile(env);
  const candidates = profile
    ? [`.env.${profile}.local`, `.env.${profile}`, ".env.local", ".env"]
    : [".env.local", ".env"];
  return [...new Set(candidates)];
}

function loadDotenvFilesFromDir(dirPath: string, opts: { quiet: boolean }) {
  for (const relativePath of buildEnvCandidates(process.env)) {
    const candidatePath = path.join(dirPath, relativePath);
    if (!fs.existsSync(candidatePath)) {
      continue;
    }
    dotenv.config({ quiet: opts.quiet, path: candidatePath, override: false });
  }
}

export function loadDotEnv(opts?: { quiet?: boolean }) {
  const quiet = opts?.quiet ?? true;

  // Load from process CWD first, with optional OPENCLAW_ENV/NODE_ENV overlays.
  loadDotenvFilesFromDir(process.cwd(), { quiet });

  // Then load global fallback: ~/.bustly/.env (or OPENCLAW_STATE_DIR/.env),
  // without overriding any env vars already present.
  loadDotenvFilesFromDir(resolveConfigDir(process.env), { quiet });
}
