import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { createHash, randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extractArchive as extractArchiveSafe } from "../infra/archive.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { bumpSkillsSnapshotVersion } from "../agents/skills/refresh.js";
import { resolveBundledSkillsDir } from "../agents/skills/bundled-dir.js";
import { CONFIG_DIR } from "../utils.js";
import { bustlySupabaseFetch } from "./supabase.js";

export type BustlyGlobalSkillCatalogItem = {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceLabel: string;
  skillKey: string;
  filePath: string;
  homepage?: string;
  primaryEnv?: string;
  eligible: boolean;
  bundled: boolean;
  category: string;
  defaultInstalled: boolean;
  installed: boolean;
  installedVersionId?: string;
  publishedVersionId?: string;
  hasUpdate: boolean;
  canInstall: boolean;
  canUpdate: boolean;
  canUninstall: boolean;
};

type BustlyGlobalSkillCatalogRow = Record<string, unknown>;

type BustlySkillArtifact = {
  zipUrl: string;
  sha256: string;
  sizeBytes?: number;
};

type BustlyCatalogResolvedRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  layer?: string;
  subLayer?: string;
  publishedVersionId?: string;
  defaultInstalled: boolean;
  homepage?: string;
  primaryEnv?: string;
  artifact?: BustlySkillArtifact;
};

type BustlyInstalledSkillManifest = {
  skillKey: string;
  publishedVersionId: string;
  installedAt: string;
  source: "skillops-zip";
};

type BustlyInstalledSkillRecord = {
  manifest: BustlyInstalledSkillManifest;
  installDir: string;
};

type BustlyDefaultInstalledSnapshotEntry = {
  skillKey: string;
  skillName: string;
  installedVersionId?: string;
};

type BustlyDefaultInstalledSnapshot = {
  version: 1;
  updatedAt: string;
  skills: BustlyDefaultInstalledSnapshotEntry[];
};

const BUSTLY_SKILL_SOURCE_LABELS: Record<string, string> = {
  "openclaw-bundled": "Built-in",
  "openclaw-managed": "Managed",
  "openclaw-workspace": "Workspace",
  "openclaw-extra": "Shared",
  "agents-skills-personal": "Workspace",
  "agents-skills-project": "Workspace",
  "skillops-catalog": "Catalog",
};

const BUSTLY_LAYER_CATEGORY_LABELS: Record<string, string> = {
  core: "General",
  ecommerce: "Ecommerce / DTC",
  retail: "Retail Stores",
  "food-bev": "Food & Beverage",
  "health-beauty": "Health & Beauty",
  professional: "Professional Services",
  "home-service": "Home Services",
  enterprise: "General",
};

const BUSTLY_SKILL_MANIFEST_FILENAME = ".bustly-skill.json";
const BUSTLY_DEFAULT_INSTALLED_SNAPSHOT_FILENAME = ".bustly-default-installed.json";
const BUSTLY_DEFAULT_ENABLED_FILENAME = ".bustly-default-enabled.json";
const BUSTLY_SKILL_DOWNLOAD_TIMEOUT_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return undefined;
}

function getByPath(source: unknown, pathParts: readonly string[]): unknown {
  let current = source;
  for (const part of pathParts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function pickFirstString(source: unknown, candidates: readonly (readonly string[])[]): string | undefined {
  for (const pathParts of candidates) {
    const value = toOptionalString(getByPath(source, pathParts));
    if (value) {
      return value;
    }
  }
  return undefined;
}

function pickFirstNumber(source: unknown, candidates: readonly (readonly string[])[]): number | undefined {
  for (const pathParts of candidates) {
    const value = toOptionalNumber(getByPath(source, pathParts));
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function resolveBustlyManagedSkillsDir(): string {
  return join(CONFIG_DIR, "skills");
}

function resolveBustlyDefaultInstalledSnapshotPath(): string {
  return join(resolveBustlyManagedSkillsDir(), BUSTLY_DEFAULT_INSTALLED_SNAPSHOT_FILENAME);
}

function readBundledDefaultEnabledSkillTokens(): Set<string> {
  const bundledSkillsDir = resolveBundledSkillsDir();
  if (!bundledSkillsDir) {
    return new Set();
  }
  const defaultEnabledPath = join(bundledSkillsDir, BUSTLY_DEFAULT_ENABLED_FILENAME);
  if (!existsSync(defaultEnabledPath)) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(readFileSync(defaultEnabledPath, "utf-8")) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.defaultEnabled)) {
      return new Set();
    }
    const tokens = new Set<string>();
    for (const entry of parsed.defaultEnabled) {
      const value = typeof entry === "string" ? entry.trim() : "";
      if (!value) {
        continue;
      }
      const token = normalizeBustlySkillLookupToken(value);
      if (token) {
        tokens.add(token);
      }
    }
    return tokens;
  } catch {
    return new Set();
  }
}

function normalizeBustlySkillLookupToken(value: string | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/["'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") ?? "";
}

function resolveManagedSkillDirName(skillKey: string): string {
  const normalized = normalizeBustlySkillLookupToken(skillKey);
  if (!normalized) {
    throw new Error(`Invalid skill key: ${skillKey}`);
  }
  return normalized;
}

function formatBustlySkillCategoryLabel(value: string | undefined): string {
  const normalized = normalizeBustlySkillLookupToken(value);
  if (!normalized) {
    return "Uncategorized";
  }
  const layerLabel = BUSTLY_LAYER_CATEGORY_LABELS[normalized];
  if (layerLabel) {
    return layerLabel;
  }
  return "Uncategorized";
}

function resolveBustlySkillSourceLabel(source: string): string {
  return BUSTLY_SKILL_SOURCE_LABELS[source] ?? source.replace(/^openclaw-/, "").replace(/^agents-skills-/, "");
}

function parseBustlySkillManifest(raw: string): BustlyInstalledSkillManifest | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    const skillKey = toOptionalString(parsed.skillKey);
    const publishedVersionId = toOptionalString(parsed.publishedVersionId);
    const installedAt = toOptionalString(parsed.installedAt);
    const source = toOptionalString(parsed.source);
    if (!skillKey || !publishedVersionId || !installedAt || source !== "skillops-zip") {
      return null;
    }
    return {
      skillKey,
      publishedVersionId,
      installedAt,
      source: "skillops-zip",
    };
  } catch {
    return null;
  }
}

function readInstalledSkillRecords(): Map<string, BustlyInstalledSkillRecord> {
  const managedSkillsDir = resolveBustlyManagedSkillsDir();
  const map = new Map<string, BustlyInstalledSkillRecord>();
  if (!existsSync(managedSkillsDir)) {
    return map;
  }

  const entries = readdirSync(managedSkillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith(".")) {
      continue;
    }
    const installDir = join(managedSkillsDir, entry.name);
    const manifestPath = join(installDir, BUSTLY_SKILL_MANIFEST_FILENAME);
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = parseBustlySkillManifest(readFileSync(manifestPath, "utf-8"));
    if (!manifest) {
      continue;
    }
    const token = normalizeBustlySkillLookupToken(manifest.skillKey);
    if (!token) {
      continue;
    }
    map.set(token, {
      manifest,
      installDir,
    });
  }

  return map;
}

function writeInstalledSkillManifest(targetDir: string, manifest: BustlyInstalledSkillManifest): void {
  const manifestPath = join(targetDir, BUSTLY_SKILL_MANIFEST_FILENAME);
  writeFileSync(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  renameSync(`${manifestPath}.tmp`, manifestPath);
}

function readDefaultInstalledSnapshot(): BustlyDefaultInstalledSnapshot {
  const path = resolveBustlyDefaultInstalledSnapshotPath();
  if (!existsSync(path)) {
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      skills: [],
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.skills)) {
      throw new Error("invalid snapshot");
    }
    const skills: BustlyDefaultInstalledSnapshotEntry[] = parsed.skills
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }
        const skillKey = toOptionalString(entry.skillKey);
        const skillName = toOptionalString(entry.skillName);
        if (!skillKey || !skillName) {
          return null;
        }
        const installedVersionId = toOptionalString(entry.installedVersionId);
        return {
          skillKey,
          skillName,
          ...(installedVersionId ? { installedVersionId } : {}),
        };
      })
      .filter((entry): entry is BustlyDefaultInstalledSnapshotEntry => Boolean(entry));
    return {
      version: 1,
      updatedAt: toOptionalString(parsed.updatedAt) ?? new Date(0).toISOString(),
      skills,
    };
  } catch {
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      skills: [],
    };
  }
}

function writeDefaultInstalledSnapshot(snapshot: BustlyDefaultInstalledSnapshot): void {
  const snapshotPath = resolveBustlyDefaultInstalledSnapshotPath();
  mkdirSync(dirname(snapshotPath), { recursive: true, mode: 0o700 });
  const tempPath = `${snapshotPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  renameSync(tempPath, snapshotPath);
}

function resolveCatalogDefaultInstalled(rows: BustlyCatalogResolvedRow[]): Map<string, BustlyDefaultInstalledSnapshotEntry> {
  const previous = readDefaultInstalledSnapshot();
  const previousByToken = new Map(
    previous.skills.map((entry) => [normalizeBustlySkillLookupToken(entry.skillKey), entry]),
  );

  const nextEntries: BustlyDefaultInstalledSnapshotEntry[] = [];
  const byToken = new Map<string, BustlyDefaultInstalledSnapshotEntry>();

  for (const row of rows) {
    if (!row.defaultInstalled) {
      continue;
    }
    const skillKeyToken = normalizeBustlySkillLookupToken(row.slug);
    if (!skillKeyToken) {
      continue;
    }
    const previousEntry = previousByToken.get(skillKeyToken);
    const installedVersionId =
      previousEntry?.installedVersionId ?? row.publishedVersionId;
    const entry: BustlyDefaultInstalledSnapshotEntry = {
      skillKey: row.slug,
      skillName: row.name,
      ...(installedVersionId ? { installedVersionId } : {}),
    };
    byToken.set(skillKeyToken, entry);
    nextEntries.push(entry);
  }

  nextEntries.sort((left, right) => left.skillKey.localeCompare(right.skillKey));
  writeDefaultInstalledSnapshot({
    version: 1,
    updatedAt: new Date().toISOString(),
    skills: nextEntries,
  });
  return byToken;
}

async function ensureDefaultInstalledSkillsMaterialized(
  rows: BustlyCatalogResolvedRow[],
): Promise<void> {
  const installedRecords = readInstalledSkillRecords();
  let changed = false;

  for (const row of rows) {
    if (!row.defaultInstalled) {
      continue;
    }

    const skillToken = normalizeBustlySkillLookupToken(row.slug);
    if (!skillToken) {
      continue;
    }

    const installedRecord = installedRecords.get(skillToken);
    const { publishedVersionId, artifact } = resolveCatalogRowForMutation({
      skillKey: row.slug,
      row,
    });

    // Default-installed skills should be materialized when missing, but never
    // auto-updated during catalog listing. Updates must stay manual so UI can
    // surface "Update available" consistently.
    if (installedRecord) {
      continue;
    }

    try {
      const installDir = await installFromSkillArtifact({
        skillKey: row.slug,
        publishedVersionId,
        artifact,
      });
      installedRecords.set(skillToken, {
        manifest: {
          skillKey: row.slug,
          publishedVersionId,
          installedAt: new Date().toISOString(),
          source: "skillops-zip",
        },
        installDir,
      });
      changed = true;
    } catch {
      // Best-effort materialization: keep catalog/listing available even when one
      // default skill artifact is temporarily unavailable.
    }
  }

  if (changed) {
    bumpSkillsSnapshotVersion({ reason: "manual" });
  }
}

function resolvePublishedSkillArtifact(row: BustlyGlobalSkillCatalogRow): BustlySkillArtifact | undefined {
  const zipUrl = pickFirstString(row, [
    ["published_zip_url"],
    ["published_zip_download_url"],
    ["published_artifact_url"],
    ["zip_url"],
    ["artifact_url"],
    ["metadata", "published_zip_url"],
    ["metadata", "publishedZipUrl"],
    ["metadata", "published", "zipUrl"],
    ["metadata", "release", "zipUrl"],
    ["metadata", "artifact", "zipUrl"],
    ["metadata", "artifact", "url"],
  ]);
  const sha256 = pickFirstString(row, [
    ["published_zip_sha256"],
    ["published_artifact_sha256"],
    ["zip_sha256"],
    ["artifact_sha256"],
    ["metadata", "published_zip_sha256"],
    ["metadata", "publishedZipSha256"],
    ["metadata", "published", "zipSha256"],
    ["metadata", "release", "zipSha256"],
    ["metadata", "artifact", "sha256"],
  ]);
  if (!zipUrl || !sha256) {
    return undefined;
  }
  return {
    zipUrl,
    sha256: sha256.toLowerCase(),
    sizeBytes: pickFirstNumber(row, [
      ["published_zip_size"],
      ["published_zip_size_bytes"],
      ["published_artifact_size"],
      ["zip_size"],
      ["metadata", "published_zip_size"],
      ["metadata", "publishedZipSize"],
      ["metadata", "published", "zipSize"],
      ["metadata", "release", "zipSize"],
      ["metadata", "artifact", "size"],
      ["metadata", "artifact", "sizeBytes"],
    ]),
  };
}

function isCatalogRowPublishedInstallable(row: BustlyCatalogResolvedRow): boolean {
  return Boolean(
    row.publishedVersionId?.trim()
    && row.artifact?.zipUrl?.trim()
    && row.artifact?.sha256?.trim(),
  );
}

function resolveDefaultInstalledFromBundledPolicy(params: {
  slug: string;
  name: string;
  defaultInstalledSkillTokens: Set<string>;
}): boolean {
  if (params.defaultInstalledSkillTokens.size === 0) {
    return false;
  }
  const slugToken = normalizeBustlySkillLookupToken(params.slug);
  if (slugToken && params.defaultInstalledSkillTokens.has(slugToken)) {
    return true;
  }
  const nameToken = normalizeBustlySkillLookupToken(params.name);
  return Boolean(nameToken && params.defaultInstalledSkillTokens.has(nameToken));
}

function resolveCatalogRow(
  row: BustlyGlobalSkillCatalogRow,
  index: number,
  defaultInstalledSkillTokens: Set<string>,
): BustlyCatalogResolvedRow {
  const slug =
    toOptionalString(row.slug)
    ?? toOptionalString(row.skill_id)
    ?? toOptionalString(row.name)
    ?? `skill-${index + 1}`;
  const name = toOptionalString(row.name) ?? slug;
  const metadata = isRecord(row.metadata) ? row.metadata : undefined;
  const defaultInstalled = resolveDefaultInstalledFromBundledPolicy({
    slug,
    name,
    defaultInstalledSkillTokens,
  });

  return {
    id: slug,
    slug,
    name,
    description: toOptionalString(row.description) ?? "",
    layer: toOptionalString(row.layer)
      ?? (metadata ? toOptionalString(metadata.layer) : undefined),
    subLayer: toOptionalString(row.sub_layer)
      ?? (metadata ? toOptionalString(metadata.sub_layer) : undefined),
    publishedVersionId: toOptionalString(row.published_version_id)
      ?? toOptionalString(row.publishedVersionId),
    defaultInstalled,
    homepage: toOptionalString(row.homepage)
      ?? (metadata ? toOptionalString(metadata.homepage) : undefined),
    primaryEnv: toOptionalString(row.primary_env)
      ?? toOptionalString(row.primaryEnv)
      ?? (metadata ? toOptionalString(metadata.primary_env) : undefined)
      ?? (metadata ? toOptionalString(metadata.primaryEnv) : undefined),
    artifact: resolvePublishedSkillArtifact(row),
  };
}

async function fetchBustlyGlobalSkillCatalogRows(
  options?: { slug?: string },
): Promise<BustlyCatalogResolvedRow[]> {
  const query = new URLSearchParams({
    select: "*",
    status: "eq.enabled",
    order: "name.asc",
  });
  const normalizedSlug = options?.slug?.trim();
  if (normalizedSlug) {
    query.set("slug", `eq.${normalizedSlug}`);
    query.set("limit", "1");
  }
  const response = await bustlySupabaseFetch({
    path: `/rest/v1/skills?${query.toString()}`,
    headers: {
      "Accept-Profile": "skillops",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load skill catalog (status ${response.status}).`);
  }
  const payload = (await response.json()) as unknown;
  const rows = Array.isArray(payload)
    ? payload.filter((entry): entry is BustlyGlobalSkillCatalogRow => isRecord(entry))
    : [];
  const defaultInstalledSkillTokens = readBundledDefaultEnabledSkillTokens();
  return rows
    .map((row, index) => resolveCatalogRow(row, index, defaultInstalledSkillTokens))
    .filter((row) => isCatalogRowPublishedInstallable(row));
}

function resolveSkillCatalogItemSource(params: {
  defaultInstalled: boolean;
  installedRecord?: BustlyInstalledSkillRecord;
}): string {
  if (params.installedRecord) {
    return "openclaw-managed";
  }
  if (params.defaultInstalled) {
    return "openclaw-bundled";
  }
  return "skillops-catalog";
}

function normalizeSha256(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^sha256:/, "")
    .replaceAll(":", "");
}

function isNodeReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return Boolean(value && typeof (value as NodeJS.ReadableStream).pipe === "function");
}

async function downloadArtifactZip(params: {
  zipUrl: string;
  archivePath: string;
}): Promise<{ bytes: number }> {
  const { response, release } = await fetchWithSsrFGuard({
    url: params.zipUrl,
    timeoutMs: BUSTLY_SKILL_DOWNLOAD_TIMEOUT_MS,
    init: {
      headers: {
        Accept: "application/octet-stream,application/zip;q=0.9,*/*;q=0.1",
      },
    },
    auditContext: "bustly-skill-catalog",
  });

  try {
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status} ${response.statusText})`);
    }
    mkdirSync(dirname(params.archivePath), { recursive: true, mode: 0o700 });
    const output = createWriteStream(params.archivePath);
    const body = response.body as unknown;
    const readable = isNodeReadableStream(body)
      ? body
      : Readable.fromWeb(body as NodeReadableStream);
    await pipeline(readable, output);
    const bytes = statSync(params.archivePath).size;
    return { bytes };
  } finally {
    await release();
  }
}

function computeFileSha256Hex(filePath: string): string {
  const hash = createHash("sha256");
  const buffer = readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

function findSinglePayloadRoot(extractDir: string): string {
  const rootSkillMd = join(extractDir, "SKILL.md");
  if (existsSync(rootSkillMd)) {
    return extractDir;
  }

  const entries = readdirSync(extractDir, { withFileTypes: true }).filter((entry) => {
    if (entry.name === "__MACOSX") {
      return false;
    }
    if (entry.name.startsWith(".")) {
      return false;
    }
    return true;
  });
  const directoryEntries = entries.filter((entry) => entry.isDirectory());
  const fileEntries = entries.filter((entry) => entry.isFile());

  const candidates = directoryEntries.filter((entry) =>
    existsSync(join(extractDir, entry.name, "SKILL.md")),
  );
  if (candidates.length === 1 && fileEntries.length === 0) {
    return join(extractDir, candidates[0].name);
  }

  throw new Error("Skill package is missing SKILL.md at archive root.");
}

function atomicallyReplaceManagedSkill(params: {
  skillKey: string;
  payloadDir: string;
  publishedVersionId: string;
}): string {
  const managedSkillsDir = resolveBustlyManagedSkillsDir();
  mkdirSync(managedSkillsDir, { recursive: true, mode: 0o700 });

  const installDirName = resolveManagedSkillDirName(params.skillKey);
  const targetDir = join(managedSkillsDir, installDirName);
  const nonce = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const stagingDir = join(managedSkillsDir, `.${installDirName}.stage-${nonce}`);
  const backupDir = join(managedSkillsDir, `.${installDirName}.backup-${nonce}`);

  cpSync(params.payloadDir, stagingDir, { recursive: true, force: true });
  writeInstalledSkillManifest(stagingDir, {
    skillKey: params.skillKey,
    publishedVersionId: params.publishedVersionId,
    installedAt: new Date().toISOString(),
    source: "skillops-zip",
  });

  let movedExisting = false;
  try {
    if (existsSync(targetDir)) {
      renameSync(targetDir, backupDir);
      movedExisting = true;
    }
    renameSync(stagingDir, targetDir);
    if (movedExisting && existsSync(backupDir)) {
      rmSync(backupDir, { recursive: true, force: true });
    }
    return targetDir;
  } catch (error) {
    if (existsSync(stagingDir)) {
      rmSync(stagingDir, { recursive: true, force: true });
    }
    if (movedExisting && existsSync(backupDir) && !existsSync(targetDir)) {
      renameSync(backupDir, targetDir);
    }
    throw error;
  }
}

function installFromSkillArtifact(params: {
  skillKey: string;
  publishedVersionId: string;
  artifact: BustlySkillArtifact;
}): Promise<string> {
  const managedSkillsDir = resolveBustlyManagedSkillsDir();
  mkdirSync(managedSkillsDir, { recursive: true, mode: 0o700 });

  const nonce = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const installWorkDir = join(managedSkillsDir, `.install-${resolveManagedSkillDirName(params.skillKey)}-${nonce}`);
  const archivePath = join(installWorkDir, "skill.zip");
  const extractDir = join(installWorkDir, "extract");

  mkdirSync(installWorkDir, { recursive: true, mode: 0o700 });
  mkdirSync(extractDir, { recursive: true, mode: 0o700 });

  return (async () => {
    try {
      const download = await downloadArtifactZip({
        zipUrl: params.artifact.zipUrl,
        archivePath,
      });

      if (
        params.artifact.sizeBytes !== undefined
        && download.bytes !== params.artifact.sizeBytes
      ) {
        throw new Error(
          `Skill package size mismatch (expected ${params.artifact.sizeBytes} bytes, got ${download.bytes} bytes).`,
        );
      }

      const actualSha = computeFileSha256Hex(archivePath);
      const expectedSha = normalizeSha256(params.artifact.sha256);
      if (actualSha !== expectedSha) {
        throw new Error(
          `Skill package checksum mismatch (expected ${expectedSha}, got ${actualSha}).`,
        );
      }

      await extractArchiveSafe({
        archivePath,
        destDir: extractDir,
        timeoutMs: BUSTLY_SKILL_DOWNLOAD_TIMEOUT_MS,
        kind: "zip",
      });

      const payloadDir = findSinglePayloadRoot(extractDir);
      const skillMdPath = join(payloadDir, "SKILL.md");
      if (!existsSync(skillMdPath)) {
        throw new Error(`Skill "${params.skillKey}" package is missing SKILL.md.`);
      }
      const stat = lstatSync(skillMdPath);
      if (!stat.isFile()) {
        throw new Error(`Skill "${params.skillKey}" package has an invalid SKILL.md.`);
      }

      return atomicallyReplaceManagedSkill({
        skillKey: params.skillKey,
        payloadDir,
        publishedVersionId: params.publishedVersionId,
      });
    } finally {
      rmSync(installWorkDir, { recursive: true, force: true });
    }
  })();
}

function resolveCatalogRowForMutation(params: {
  skillKey: string;
  row: BustlyCatalogResolvedRow;
}): {
  publishedVersionId: string;
  artifact: BustlySkillArtifact;
} {
  const publishedVersionId = params.row.publishedVersionId?.trim();
  if (!publishedVersionId) {
    throw new Error(`Skill "${params.skillKey}" does not have a published version yet.`);
  }
  const artifact = params.row.artifact;
  if (!artifact?.zipUrl?.trim() || !artifact.sha256?.trim()) {
    throw new Error(
      `Skill "${params.skillKey}" is missing published ZIP metadata (zip URL + sha256).`,
    );
  }
  return {
    publishedVersionId,
    artifact,
  };
}

export function resolveBustlyDefaultInstalledSkillTokens(): Set<string> {
  return readBundledDefaultEnabledSkillTokens();
}

export async function refreshBustlyDefaultInstalledSkillsSnapshot(): Promise<void> {
  const rows = await fetchBustlyGlobalSkillCatalogRows();
  resolveCatalogDefaultInstalled(rows);
  await ensureDefaultInstalledSkillsMaterialized(rows);
}

export async function listBustlyGlobalSkillCatalog(): Promise<BustlyGlobalSkillCatalogItem[]> {
  const rows = await fetchBustlyGlobalSkillCatalogRows();
  resolveCatalogDefaultInstalled(rows);
  await ensureDefaultInstalledSkillsMaterialized(rows);
  const installedRecords = readInstalledSkillRecords();

  return rows.map((row) => {
    const skillToken = normalizeBustlySkillLookupToken(row.slug);
    const installedRecord = skillToken ? installedRecords.get(skillToken) : undefined;
    const installedVersionId = installedRecord?.manifest.publishedVersionId;

    const publishedVersionId = row.publishedVersionId;
    const hasUpdate = Boolean(
      installedVersionId
      && publishedVersionId
      && installedVersionId !== publishedVersionId,
    );
    const installed = Boolean(installedRecord);
    const hasInstallArtifact = Boolean(row.artifact?.zipUrl && row.artifact?.sha256);

    const canInstall = !installed && Boolean(publishedVersionId && hasInstallArtifact);
    const canUpdate = installed && Boolean(publishedVersionId && hasInstallArtifact && hasUpdate);
    const canUninstall = Boolean(installedRecord && !row.defaultInstalled);

    const source = resolveSkillCatalogItemSource({
      defaultInstalled: row.defaultInstalled,
      installedRecord,
    });

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      source,
      sourceLabel: resolveBustlySkillSourceLabel(source),
      skillKey: row.slug,
      filePath: installedRecord ? join(installedRecord.installDir, "SKILL.md") : "",
      homepage: row.homepage,
      primaryEnv: row.primaryEnv,
      eligible: true,
      bundled: row.defaultInstalled,
      category: formatBustlySkillCategoryLabel(row.layer),
      defaultInstalled: row.defaultInstalled,
      installed,
      installedVersionId,
      publishedVersionId,
      hasUpdate,
      canInstall,
      canUpdate,
      canUninstall,
    };
  });
}

export async function installBustlyGlobalSkill(skillKey: string): Promise<void> {
  const normalizedSkillKey = skillKey.trim();
  if (!normalizedSkillKey) {
    throw new Error("Skill key is required.");
  }

  const [row] = await fetchBustlyGlobalSkillCatalogRows({ slug: normalizedSkillKey });
  if (!row) {
    throw new Error(`Skill "${normalizedSkillKey}" not found.`);
  }

  const installedRecords = readInstalledSkillRecords();
  const skillToken = normalizeBustlySkillLookupToken(row.slug);
  const installedRecord = skillToken ? installedRecords.get(skillToken) : undefined;

  const { publishedVersionId, artifact } = resolveCatalogRowForMutation({
    skillKey: row.slug,
    row,
  });

  if (installedRecord?.manifest.publishedVersionId === publishedVersionId) {
    return;
  }

  await installFromSkillArtifact({
    skillKey: row.slug,
    publishedVersionId,
    artifact,
  });
  bumpSkillsSnapshotVersion({ reason: "manual" });
}

export async function updateBustlyGlobalSkill(skillKey: string): Promise<void> {
  const normalizedSkillKey = skillKey.trim();
  if (!normalizedSkillKey) {
    throw new Error("Skill key is required.");
  }

  const [row] = await fetchBustlyGlobalSkillCatalogRows({ slug: normalizedSkillKey });
  if (!row) {
    throw new Error(`Skill "${normalizedSkillKey}" not found.`);
  }

  const skillToken = normalizeBustlySkillLookupToken(row.slug);
  const installedRecords = readInstalledSkillRecords();
  const installedRecord = skillToken ? installedRecords.get(skillToken) : undefined;
  if (!installedRecord) {
    throw new Error(`Skill "${row.slug}" is not installed.`);
  }

  const installedVersionId = installedRecord.manifest.publishedVersionId;
  const publishedVersionId = row.publishedVersionId;

  if (!publishedVersionId) {
    throw new Error(`Skill "${row.slug}" does not have a published version yet.`);
  }

  if (installedVersionId && installedVersionId === publishedVersionId) {
    return;
  }

  const { artifact } = resolveCatalogRowForMutation({
    skillKey: row.slug,
    row,
  });

  await installFromSkillArtifact({
    skillKey: row.slug,
    publishedVersionId,
    artifact,
  });
  bumpSkillsSnapshotVersion({ reason: "manual" });
}

export async function uninstallBustlyGlobalSkill(skillKey: string): Promise<void> {
  const normalizedSkillKey = skillKey.trim();
  if (!normalizedSkillKey) {
    throw new Error("Skill key is required.");
  }
  const managedSkillsDir = resolveBustlyManagedSkillsDir();
  const installDir = join(managedSkillsDir, resolveManagedSkillDirName(normalizedSkillKey));
  const manifestPath = join(installDir, BUSTLY_SKILL_MANIFEST_FILENAME);

  if (!existsSync(installDir) || !existsSync(manifestPath)) {
    return;
  }

  const manifest = parseBustlySkillManifest(readFileSync(manifestPath, "utf-8"));
  if (!manifest || manifest.source !== "skillops-zip") {
    throw new Error(`Skill "${normalizedSkillKey}" is not managed by skillops-zip.`);
  }

  rmSync(installDir, { recursive: true, force: true });
  bumpSkillsSnapshotVersion({ reason: "manual" });
}
