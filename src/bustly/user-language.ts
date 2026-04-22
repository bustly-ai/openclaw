import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { createAsyncLock, readJsonFile, writeJsonAtomic } from "../infra/json-files.js";

type BustlyUserLanguageValue = {
  language: string;
  updatedAtMs: number;
  source?: string;
};

type BustlyUserLanguageStore = {
  version: 2;
  language?: string;
  updatedAtMs?: number;
  source?: string;
};

const STORE_VERSION = 2;
const STORE_FILENAME = "bustly-user-language.json";
const withStoreLock = createAsyncLock();

function resolveStorePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "settings", STORE_FILENAME);
}

function sanitizeSource(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeLocaleTag(value: string): string | null {
  const candidate = value.trim().replace(/_/g, "-");
  if (!candidate || candidate.length > 64) {
    return null;
  }
  try {
    const canonical = Intl.getCanonicalLocales([candidate])[0];
    return typeof canonical === "string" && canonical.trim() ? canonical.trim() : null;
  } catch {
    if (!/^[A-Za-z0-9-]+$/.test(candidate)) {
      return null;
    }
    return candidate;
  }
}

function normalizeEntry(
  entry: {
    language?: string;
    updatedAtMs?: number;
    source?: string;
  } | null | undefined,
): BustlyUserLanguageValue | null {
  const normalizedLanguage =
    entry && typeof entry.language === "string" ? normalizeLocaleTag(entry.language) : null;
  const updatedAtMs =
    entry && typeof entry.updatedAtMs === "number" && Number.isFinite(entry.updatedAtMs)
      ? entry.updatedAtMs
      : 0;
  if (!normalizedLanguage || updatedAtMs <= 0) {
    return null;
  }
  return {
    language: normalizedLanguage,
    updatedAtMs,
    source: sanitizeSource(entry?.source),
  };
}

function normalizeStore(raw: BustlyUserLanguageStore | null): BustlyUserLanguageStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      version: STORE_VERSION,
    };
  }

  if (raw.version === STORE_VERSION) {
    const normalized = normalizeEntry(raw);
    return normalized
      ? { version: STORE_VERSION, ...normalized }
      : {
          version: STORE_VERSION,
        };
  }
  return {
    version: STORE_VERSION,
  };
}

export async function setBustlyUserLanguage(params: {
  language: string;
  source?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ language: string; updatedAtMs: number; source?: string }> {
  const normalizedLanguage = normalizeLocaleTag(params.language);
  if (!normalizedLanguage) {
    throw new Error("language must be a valid locale tag (for example: en-US)");
  }
  const source = sanitizeSource(params.source);
  const storePath = resolveStorePath(params.env);
  return await withStoreLock(async () => {
    const updatedAtMs = Date.now();
    const next: BustlyUserLanguageStore = {
      version: STORE_VERSION,
      language: normalizedLanguage,
      updatedAtMs,
      ...(source ? { source } : {}),
    };
    await writeJsonAtomic(storePath, next);
    return {
      language: normalizedLanguage,
      updatedAtMs,
      ...(source ? { source } : {}),
    };
  });
}

export async function getBustlyUserLanguage(params?: { env?: NodeJS.ProcessEnv }): Promise<string | null> {
  const store = normalizeStore(
    await readJsonFile<BustlyUserLanguageStore>(resolveStorePath(params?.env)),
  );
  return store.language ?? null;
}
