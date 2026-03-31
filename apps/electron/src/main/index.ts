import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  shell,
  powerSaveBlocker,
  dialog,
  type OpenDialogOptions,
} from "electron";
import * as Sentry from "@sentry/electron/main";
import JSZip from "jszip";
import { randomUUID } from "node:crypto";
import { resolve, dirname, basename, join, relative } from "node:path";
import { fork, spawnSync, ChildProcess } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  statSync,
  rmSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Socket, createServer } from "node:net";
import updater from "electron-updater";
import {
  initializeOpenClaw,
  getConfigPath,
  isFullyInitialized,
  type InitializationResult,
} from "./auto-init.js";
import {
  ensureBundledOpenClawShim,
  resolveBundledBustlyBinDir,
  resolveNodeBinary,
  resolveOpenClawCliPath,
} from "./cli-utils.js";
import {
  exchangeToken,
  generateLoginUrl,
  startOAuthCallbackServer,
  stopOAuthCallbackServer,
  cancelOAuthFlow,
} from "./oauth-handler.js";
import * as BustlyOAuth from "./bustly-oauth.js";
import { initializeBustlyWorkspaceBootstrap } from "./bustly-bootstrap.js";
import { resolveOpenClawAgentDir } from "../../../../src/agents/agent-paths";
import { ensureAgentWorkspace } from "../../../../src/agents/workspace";
import { loadConfig } from "../../../../src/config/config";
import { loadSessionStore, updateSessionStore } from "../../../../src/config/sessions";
import { resolveDefaultSessionStorePath } from "../../../../src/config/sessions/paths";
import { applyAgentConfig, listAgentEntries, pruneAgentConfig } from "../../../../src/commands/agents.config";
import { GatewayClient } from "../../../../src/gateway/client";
import type { SessionsPatchResult } from "../../../../src/gateway/protocol";
import type { OpenClawConfig } from "../../../../src/config/types";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../../../../src/utils/message-channel";
import {
  applyAuthProfileConfig,
  applyOpenrouterProviderConfig,
  setOpenrouterApiKey,
} from "../../../../src/commands/onboard-auth";
import { applyPrimaryModel } from "../../../../src/commands/model-picker";
import {
  ELECTRON_DEFAULT_MODEL,
  ELECTRON_OPENCLAW_PROFILE,
  getElectronOpenrouterApiKey,
  resolveElectronBackendLogPath,
  resolveElectronIsolatedConfigPath,
  resolveElectronIsolatedStateDir,
  resolveElectronBustlyWorkspaceTemplateBaseUrl,
} from "./defaults.js";
import {
  buildBustlyAgentConversationSessionKey,
  buildBustlyWorkspaceAgentPrefix,
  DEFAULT_BUSTLY_AGENT_NAME,
  buildBustlyWorkspaceAgentId,
  isBustlyAgentConversationSessionKey,
  normalizeBustlyAgentName,
  normalizeBustlyWorkspaceId,
} from "../shared/bustly-agent.js";
import { normalizeAgentId } from "../../../../src/routing/session-key.js";
import {
  loadBustlyMainAgentPreset,
  loadBustlyRemoteAgentPresets,
  loadEnabledBustlyRemoteAgentPresets,
} from "./bustly-agent-presets.js";
import {
  ensureMainLogPath,
  setMainLogSink,
  writeMainError,
  writeMainInfo,
  writeMainLog,
  writeMainWarn,
} from "./logger.js";

type BustlyWorkspaceAgentSummary = {
  agentId: string;
  agentName: string;
  name: string;
  icon?: string;
  isMain: boolean;
  updatedAt: number | null;
};

type BustlyWorkspaceAgentSessionSummary = {
  agentId: string;
  sessionKey: string;
  name: string;
  icon?: string;
  updatedAt: number | null;
};

type BustlyAgentMetadata = {
  icon?: string;
};

type OpenClawAgentListEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const SENTRY_DSN =
  "https://03becf8322280fe9b5b01c0524874af0@o4511115803557888.ingest.us.sentry.io/4511115804737536";

function syncSentryBustlyScope(): void {
  try {
    const user = BustlyOAuth.readBustlyOAuthState()?.user;
    const userId = user?.userId?.trim() || "";
    const workspaceId = user?.workspaceId?.trim() || "";
    const email = user?.userEmail?.trim() || "";
    const username = user?.userName?.trim() || "";

    Sentry.setUser(
      userId || email || username
        ? {
            id: userId || undefined,
            email: email || undefined,
            username: username || undefined,
          }
        : null,
    );
    Sentry.setTag("workspace_id", workspaceId || "");
    Sentry.setTag("uid", userId || "");
    Sentry.setContext(
      "bustly",
      workspaceId || userId || email || username
        ? {
            workspaceId: workspaceId || undefined,
            userId: userId || undefined,
            userEmail: email || undefined,
            userName: username || undefined,
          }
        : null,
    );
  } catch {
    // Never let Sentry scope syncing break the main process.
  }
}

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key || !value) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function stripPerAgentSkipBootstrap(
  entries: OpenClawAgentListEntry[] | undefined,
): OpenClawAgentListEntry[] | undefined {
  if (!entries) {
    return entries;
  }
  return entries.map((entry) => {
    if (!("skipBootstrap" in entry)) {
      return entry;
    }
    const { skipBootstrap: _skipBootstrap, ...rest } = entry as OpenClawAgentListEntry & {
      skipBootstrap?: boolean;
    };
    return rest;
  });
}

function loadMainProcessEnvFromDotEnv(): void {
  const envPathCandidates = [
    resolve(__dirname, "../../.env"),
    resolve(__dirname, "../.env"),
    resolve(process.cwd(), ".env"),
  ];
  for (const envPath of envPathCandidates) {
    if (!existsSync(envPath)) {
      continue;
    }
    try {
      const parsed = parseDotEnv(readFileSync(envPath, "utf-8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (!process.env[key]?.trim()) {
          process.env[key] = value;
        }
      }
      break;
    } catch (error) {
      writeMainError(`[Env] Failed to load ${envPath}:`, error);
    }
  }
}

function formatIssueReportTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function addDirectoryToZip(params: {
  zip: JSZip;
  baseDir: string;
  currentDir: string;
  pathPrefix: string;
}): void {
  const entries = readdirSync(params.currentDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = join(params.currentDir, entry.name);
    const relativePath = entryPath.slice(params.baseDir.length + 1).replace(/\\/g, "/");
    const zipPath = `${params.pathPrefix}/${relativePath}`;

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      params.zip.folder(zipPath);
      addDirectoryToZip({
        zip: params.zip,
        baseDir: params.baseDir,
        currentDir: entryPath,
        pathPrefix: params.pathPrefix,
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stat = lstatSync(entryPath);
    params.zip.file(zipPath, readFileSync(entryPath), {
      unixPermissions: stat.mode,
      date: stat.mtime,
    });
  }
}

async function createBustlyIssueReportArchive(): Promise<string> {
  const stateDir = resolve(app.getPath("home"), ".bustly");
  if (!existsSync(stateDir) || !lstatSync(stateDir).isDirectory()) {
    throw new Error(`Bustly state directory not found: ${stateDir}`);
  }

  const downloadsDir = app.getPath("downloads");
  mkdirSync(downloadsDir, { recursive: true });

  const zip = new JSZip();
  zip.folder(".bustly");
  addDirectoryToZip({
    zip,
    baseDir: stateDir,
    currentDir: stateDir,
    pathPrefix: ".bustly",
  });

  const archivePath = join(
    downloadsDir,
    `bustly-issue-report-${formatIssueReportTimestamp(new Date())}.zip`,
  );
  const archiveBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  writeFileSync(archivePath, archiveBuffer);
  shell.showItemInFolder(archivePath);
  return archivePath;
}

loadMainProcessEnvFromDotEnv();

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV || "production",
});
syncSentryBustlyScope();

if (!process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL?.trim()) {
  const appVersion = app.getVersion();
  const isDevelopment = !app.isPackaged;
  const isBetaVersion = !isDevelopment && appVersion.toLowerCase().includes("beta");
  const prodUrl = process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_PROD?.trim();
  const testUrl = process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_TEST?.trim();
  process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL =
    ((isDevelopment || isBetaVersion) ? testUrl : prodUrl) ||
    resolveElectronBustlyWorkspaceTemplateBaseUrl(isDevelopment ? "beta" : appVersion);
  writeMainInfo("[Bustly Prompts] Selected template base URL:", {
    appVersion,
    isPackaged: app.isPackaged,
    channel: isDevelopment ? "test-dev" : isBetaVersion ? "test" : "prod",
    url: process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL,
  });
}

const autoUpdater = updater.autoUpdater;
const APP_DISPLAY_NAME = "Bustly";
const APP_PROTOCOL = "bustly";
const DEEP_LINK_CHANNEL = "deep-link";

app.setName(APP_DISPLAY_NAME);

let gatewayProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let needsOnboardAtLaunch = false;
let gatewayPort: number = 17999;
let gatewayBind: string = "loopback";
let gatewayToken: string | null = null;
let bustlyLoginCancelled = false;
let bustlyLoginAttemptId = 0;

setMainLogSink((entry) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("main-log", entry);
  }
});

function emitGatewayLifecycle(phase: "starting" | "stopping" | "ready" | "error", message?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("gateway-lifecycle", {
    phase,
    message: message ?? null,
  });
}

const IMAGE_PREVIEW_EXT_RE = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|tiff|webp)$/i;

function parseClipboardFilePathsFromText(value: string): string[] {
  return value
    .split("\0")
    .join("\n")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith("#"))
    .flatMap((entry) => {
      if (!entry.startsWith("file://")) {
        return [];
      }
      try {
        const url = new URL(entry);
        if (url.protocol !== "file:") {
          return [];
        }
        return [decodeURIComponent(url.pathname)];
      } catch {
        return [];
      }
    });
}

function readNativeClipboardFilePaths(): string[] {
  const formats = clipboard.availableFormats("clipboard");
  const candidates = ["public.file-url", "NSURLPboardType", "text/uri-list"].filter((format) =>
    formats.includes(format),
  );
  const paths = new Set<string>();

  for (const format of candidates) {
    try {
      const raw = clipboard.readBuffer(format);
      for (const path of parseClipboardFilePathsFromText(raw.toString("utf8"))) {
        paths.add(path);
      }
    } catch {
      // Ignore unsupported clipboard formats.
    }
  }

  try {
    for (const path of parseClipboardFilePathsFromText(clipboard.readText("clipboard"))) {
      paths.add(path);
    }
  } catch {
    // Ignore plain-text clipboard failures.
  }

  return [...paths];
}

function basenameFromResolvedPath(pathValue: string): string {
  return basename(pathValue.replace(/[\\/]+$/, "")) || pathValue;
}

function resolvePastedPath(params: {
  directPath?: string;
  entryPath?: string;
  entryName?: string;
  transferPaths?: string[];
  fallbackKind: "file" | "directory";
}): { path: string; kind: "file" | "directory" | null } {
  const directPath = typeof params.directPath === "string" ? params.directPath.trim() : "";
  if (directPath) {
    try {
      return {
        path: directPath,
        kind: statSync(directPath).isDirectory() ? "directory" : "file",
      };
    } catch {
      return { path: directPath, kind: params.fallbackKind };
    }
  }

  const transferPaths = Array.isArray(params.transferPaths)
    ? params.transferPaths
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const clipboardPaths = transferPaths.length > 0 ? transferPaths : readNativeClipboardFilePaths();
  const entryPath = typeof params.entryPath === "string" ? params.entryPath.trim() : "";
  const entryName = typeof params.entryName === "string" ? params.entryName.trim() : "";

  let resolvedPath = "";
  if (clipboardPaths.length === 1) {
    resolvedPath = clipboardPaths[0];
  } else if (entryName) {
    resolvedPath =
      clipboardPaths.find((candidate) => basenameFromResolvedPath(candidate) === entryName) ?? "";
  }
  if (!resolvedPath) {
    resolvedPath = entryPath;
  }
  if (!resolvedPath) {
    return { path: "", kind: null };
  }

  try {
    return {
      path: resolvedPath,
      kind: statSync(resolvedPath).isDirectory() ? "directory" : "file",
    };
  } catch {
    return { path: resolvedPath, kind: params.fallbackKind };
  }
}

function resolveImagePreviewMimeType(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) {return "image/png";}
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {return "image/jpeg";}
  if (lower.endsWith(".gif")) {return "image/gif";}
  if (lower.endsWith(".webp")) {return "image/webp";}
  if (lower.endsWith(".bmp")) {return "image/bmp";}
  if (lower.endsWith(".svg")) {return "image/svg+xml";}
  if (lower.endsWith(".avif")) {return "image/avif";}
  if (lower.endsWith(".heic")) {return "image/heic";}
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) {return "image/tiff";}
  return null;
}
let updateReady = false;
let updateVersion: string | null = null;
let updateInstalling = false;
type DeepLinkPayload = {
  url: string;
  route: string | null;
  workspaceId: string | null;
};

let pendingDeepLink: DeepLinkPayload | null = null;

const EXTERNAL_NAV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Za-z]:[\\/]/;
const HOME_RELATIVE_PATH_RE = /^~(?:[\\/]|$)/;

function isOpenableLocalPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\\\") ||
    WINDOWS_ABSOLUTE_PATH_RE.test(trimmed) ||
    HOME_RELATIVE_PATH_RE.test(trimmed)
  );
}

function decodeOpenableLocalPath(value: string): string {
  if (!value.includes("%")) {
    return value;
  }
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function resolveOpenableLocalPath(value: string): string {
  const trimmed = decodeOpenableLocalPath(value.trim());
  if (!HOME_RELATIVE_PATH_RE.test(trimmed)) {
    return trimmed;
  }
  const suffix = trimmed.slice(1).replace(/^[/\\]+/, "");
  return suffix ? join(app.getPath("home"), suffix) : app.getPath("home");
}

function shouldOpenExternal(url: string): boolean {
  if (!url) {
    return false;
  }
  if (url.startsWith("about:") || url.startsWith("file:")) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  return !EXTERNAL_NAV_HOSTS.has(parsed.hostname.toLowerCase());
}

function normalizeDeepLinkRoute(route: string | null | undefined): string | null {
  if (!route) {
    return null;
  }
  const normalized = route.replace(/^#\/?/, "").replace(/^\/+/, "").trim();
  if (!normalized) {
    return null;
  }
  if (normalized === "home") {
    return "/";
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function resolveBustlyWebBaseUrl(): string {
  const baseUrl = process.env.BUSTLY_WEB_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing BUSTLY_WEB_BASE_URL");
  }
  return baseUrl.replace(/\/+$/, "");
}

function buildBustlyAdminUrl(params: Record<string, string | null | undefined>, path?:string): string {
  const url = new URL(`${resolveBustlyWebBaseUrl()}/admin${path ?? ""}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function parseDeepLink(url: string): DeepLinkPayload | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${APP_PROTOCOL}:`) {
    return null;
  }

  const routeFromQuery = normalizeDeepLinkRoute(parsed.searchParams.get("route"));
  const routeFromPath = normalizeDeepLinkRoute(parsed.pathname);
  const routeFromHost =
    parsed.hostname && parsed.hostname !== "open" ? normalizeDeepLinkRoute(parsed.hostname) : null;
  const workspaceId =
    parsed.searchParams.get("workspace_id")?.trim() ||
    parsed.searchParams.get("workspaceId")?.trim() ||
    null;

  return {
    url,
    route: routeFromQuery ?? routeFromPath ?? routeFromHost ?? null,
    workspaceId,
  };
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function dispatchDeepLink(url: string): boolean {
  void (async () => {
    const payload = parseDeepLink(url);
    if (!payload) {
      writeMainLog(`[DeepLink] ignored url=${url} reason=parse_failed`);
      return;
    }

    pendingDeepLink = payload;
    writeMainLog(
      `[DeepLink] received url=${payload.url} route=${payload.route ?? "(none)"} workspaceId=${payload.workspaceId ?? "(none)"}`,
    );

    if (!mainWindow || mainWindow.isDestroyed()) {
      writeMainLog("[DeepLink] main window missing; creating window and keeping payload pending");
      ensureWindow();
      return;
    }

    focusMainWindow();
    if (payload.workspaceId?.trim()) {
      try {
        await setActiveWorkspaceInternal(payload.workspaceId);
      } catch (error) {
        writeMainLog(
          `[DeepLink] workspace switch failed workspaceId=${payload.workspaceId} error=${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    writeMainLog("[DeepLink] dispatching payload to renderer");
    mainWindow.webContents.send(DEEP_LINK_CHANNEL, payload);
    pendingDeepLink = null;
  })();
  return true;
}

function flushPendingDeepLink() {
  if (!pendingDeepLink || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  writeMainLog(
    `[DeepLink] flush pending route=${pendingDeepLink.route ?? "(none)"} workspaceId=${pendingDeepLink.workspaceId ?? "(none)"}`,
  );
  focusMainWindow();
}

function registerProtocolClient() {
  try {
    let success = false;
    if (process.defaultApp && process.argv.length >= 2) {
      success = app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [resolve(process.argv[1])]);
    } else {
      success = app.setAsDefaultProtocolClient(APP_PROTOCOL);
    }
    writeMainLog(`[DeepLink] protocol registration ${success ? "ok" : "failed"} scheme=${APP_PROTOCOL}`);
  } catch (error) {
    writeMainLog(
      `[DeepLink] protocol registration error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
let initResult: InitializationResult | null = null;

// Gateway configuration
const GATEWAY_HOST = "127.0.0.1";
const BUSTLY_LOGIN_HASH = "/bustly-login";
const BUSTLY_PROVIDER_ID = "bustly";
const BUSTLY_PROVIDER_PROFILE_ID = `${BUSTLY_PROVIDER_ID}:default`;
const BUSTLY_MODEL_GATEWAY_BASE_URL_DEFAULT = "https://gw.bustly.ai/api/v1";
const BUSTLY_MODEL_GATEWAY_BASE_URL_ENV = process.env.BUSTLY_MODEL_GATEWAY_BASE_URL?.trim() ?? "";
const BUSTLY_MODEL_GATEWAY_BASE_URL =
  BUSTLY_MODEL_GATEWAY_BASE_URL_ENV || BUSTLY_MODEL_GATEWAY_BASE_URL_DEFAULT;
const BUSTLY_MODEL_GATEWAY_USER_AGENT =
  process.env.BUSTLY_MODEL_GATEWAY_USER_AGENT?.trim() || "openclaw/2026.2.24";
const BUSTLY_ROUTE_MODELS = [
  {
    routeKey: "chat.standard",
    modelRef: "bustly/chat.standard",
    alias: "Standard",
    description: "Fast & efficient for daily tasks.",
    reasoning: false,
  },
  {
    routeKey: "chat.advanced",
    modelRef: "bustly/chat.advanced",
    alias: "Advanced",
    description: "Balanced performance for complex reasoning.",
    reasoning: true,
  },
  {
    routeKey: "chat.ultra",
    modelRef: "bustly/chat.ultra",
    alias: "Ultra",
    description: "Frontier intelligence for critical challenges.",
    reasoning: true,
  },
] as const;
const BUSTLY_MODEL_REF_SET = new Set<string>(BUSTLY_ROUTE_MODELS.map((entry) => entry.modelRef));
const BUSTLY_ROUTE_KEY_SET = new Set<string>(BUSTLY_ROUTE_MODELS.map((entry) => entry.routeKey));
const PRELOAD_PATH = process.env.NODE_ENV === "development"
  ? resolve(__dirname, "main/preload.js")
  : resolve(__dirname, "preload.js");
const UPDATE_STATUS_CHANNEL = "update-status";
const WINDOW_NATIVE_FULLSCREEN_CHANNEL = "window-native-fullscreen";

function sendNativeFullscreenState(isNativeFullscreen: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(WINDOW_NATIVE_FULLSCREEN_CHANNEL, { isNativeFullscreen });
}

function normalizeBustlyModelRef(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (BUSTLY_MODEL_REF_SET.has(raw)) {
    return raw;
  }
  if (raw.startsWith(`${BUSTLY_PROVIDER_ID}/`)) {
    const routeKey = raw.slice(`${BUSTLY_PROVIDER_ID}/`.length);
    if (BUSTLY_ROUTE_KEY_SET.has(routeKey)) {
      return `${BUSTLY_PROVIDER_ID}/${routeKey}`;
    }
  }
  if (BUSTLY_ROUTE_KEY_SET.has(raw)) {
    return `${BUSTLY_PROVIDER_ID}/${raw}`;
  }
  if (raw === "lite" || raw === "auto") {
    return "bustly/chat.standard";
  }
  if (raw === "pro") {
    return "bustly/chat.advanced";
  }
  if (raw === "max") {
    return "bustly/chat.ultra";
  }
  return "bustly/chat.standard";
}

function resolveCurrentBustlyModelRef(cfg: OpenClawConfig): string {
  const modelConfig = cfg.agents?.defaults?.model;
  const raw = typeof modelConfig === "string"
    ? modelConfig
    : modelConfig && typeof modelConfig === "object"
      ? modelConfig.primary
      : undefined;
  return normalizeBustlyModelRef(raw);
}

function buildBustlyProviderHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": BUSTLY_MODEL_GATEWAY_USER_AGENT,
  };
  const workspaceId = BustlyOAuth.readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }
  return headers;
}

function buildBustlyProviderModels(headers: Record<string, string>) {
  return BUSTLY_ROUTE_MODELS.map((entry) => ({
    id: entry.routeKey,
    name: entry.alias,
    reasoning: entry.reasoning,
    input: ["text", "image"] as Array<"text" | "image">,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 258_000,
    maxTokens: 128_000,
    headers: { ...headers },
  }));
}

function resolveBustlyGatewayBaseUrl(cfg: OpenClawConfig): string {
  if (BUSTLY_MODEL_GATEWAY_BASE_URL_ENV) {
    return BUSTLY_MODEL_GATEWAY_BASE_URL_ENV;
  }
  const configured = cfg.models?.providers?.[BUSTLY_PROVIDER_ID]?.baseUrl?.trim();
  if (configured) {
    return configured;
  }
  return BUSTLY_MODEL_GATEWAY_BASE_URL;
}

function applyBustlyOnlyConfig(cfg: OpenClawConfig, selectedModelInput?: string): OpenClawConfig {
  const selectedModel = selectedModelInput?.trim()
    ? normalizeBustlyModelRef(selectedModelInput)
    : resolveCurrentBustlyModelRef(cfg);
  const bustlyHeaders = buildBustlyProviderHeaders();
  const nextAgentModels: Record<string, { alias?: string }> = {};
  for (const entry of BUSTLY_ROUTE_MODELS) {
    nextAgentModels[entry.modelRef] = { alias: entry.alias };
  }
  const existingDefaults = cfg.agents?.defaults ?? {};
  const existingModelConfig = existingDefaults.model;
  const preservedFallbacks =
    typeof existingModelConfig === "object" &&
    existingModelConfig !== null &&
    Array.isArray((existingModelConfig as { fallbacks?: unknown }).fallbacks)
      ? (existingModelConfig as { fallbacks?: string[] }).fallbacks
      : undefined;

  return {
    ...cfg,
    auth: {
      ...cfg.auth,
      profiles: {
        [BUSTLY_PROVIDER_PROFILE_ID]: {
          provider: BUSTLY_PROVIDER_ID,
          mode: "token",
        },
      },
      order: {
        [BUSTLY_PROVIDER_ID]: [BUSTLY_PROVIDER_PROFILE_ID],
      },
    },
    agents: {
      ...cfg.agents,
      defaults: {
        ...existingDefaults,
        model: {
          ...(preservedFallbacks ? { fallbacks: preservedFallbacks } : {}),
          primary: selectedModel,
        },
        models: nextAgentModels,
      },
    },
    models: {
      ...cfg.models,
      providers: {
        [BUSTLY_PROVIDER_ID]: {
          baseUrl: resolveBustlyGatewayBaseUrl(cfg),
          auth: "token",
          api: "openai-completions",
          headers: bustlyHeaders,
          models: buildBustlyProviderModels(bustlyHeaders),
        },
      },
    },
  };
}

function syncBustlyConfigFile(configPath: string, selectedModelInput?: string): void {
  if (!existsSync(configPath)) {
    return;
  }
  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as OpenClawConfig;
  const nextConfig = applyBustlyOnlyConfig(config, selectedModelInput);
  writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
}

function resolveUserPath(input: string, homeDir: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("~")) {
    return resolve(trimmed.replace(/^~(?=$|[\\/])/, homeDir));
  }
  return resolve(trimmed);
}

function resolveElectronStateDir(): string {
  return resolveElectronIsolatedStateDir();
}

function resolveElectronConfigPath(): string {
  return resolveElectronIsolatedConfigPath();
}

function resolveBustlyWorkspaceAgentWorkspaceDir(
  workspaceId: string,
  agentName: string = DEFAULT_BUSTLY_AGENT_NAME,
): string {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  const normalizedAgentName = normalizeBustlyAgentName(agentName);
  const stateDir = resolveElectronStateDir();
  return join(stateDir, "workspaces", normalizedWorkspaceId, "agents", normalizedAgentName);
}

function resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir: string): string {
  return join(agentWorkspaceDir, ".bustly-agent.json");
}

function isPathInsideDir(parentDir: string, candidatePath: string): boolean {
  const parent = resolve(parentDir);
  const candidate = resolve(candidatePath);
  const rel = relative(parent, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("../"));
}

function removeDirIfWithinRoot(targetDir: string | undefined, rootDir: string): void {
  const trimmed = targetDir?.trim();
  if (!trimmed) {
    return;
  }
  const resolvedTarget = resolve(trimmed);
  if (!isPathInsideDir(rootDir, resolvedTarget)) {
    writeMainWarn(
      `[Workspace] Refusing to delete path outside allowed root target=${resolvedTarget} root=${resolve(rootDir)}`,
    );
    return;
  }
  rmSync(resolvedTarget, { recursive: true, force: true });
}

function loadBustlyAgentMetadata(agentWorkspaceDir: string): BustlyAgentMetadata {
  const metadataPath = resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir);
  if (!existsSync(metadataPath)) {
    return {};
  }
  try {
    const raw = readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(raw) as BustlyAgentMetadata;
    return {
      icon: parsed.icon?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

function saveBustlyAgentMetadata(agentWorkspaceDir: string, metadata: BustlyAgentMetadata): void {
  mkdirSync(agentWorkspaceDir, { recursive: true });
  writeFileSync(
    resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir),
    JSON.stringify(metadata, null, 2),
    "utf-8",
  );
}

function buildBustlyConversationSessionKey(agentId: string): string {
  return buildBustlyAgentConversationSessionKey(agentId, randomUUID());
}

function listBustlyAgentConversationSessions(agentId: string): BustlyWorkspaceAgentSessionSummary[] {
  const store = loadSessionStore(resolveDefaultSessionStorePath(agentId));
  return Object.entries(store)
    .filter(([sessionKey]) => isBustlyAgentConversationSessionKey(sessionKey, agentId))
    .map(([sessionKey, entry]) => ({
      agentId,
      sessionKey,
      name: entry.label?.trim() || "New conversation",
      icon: entry.icon?.trim() || undefined,
      updatedAt: entry.updatedAt ?? null,
    }));
}

function listBustlyWorkspaceAgentIds(cfg: OpenClawConfig, workspaceId: string): string[] {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  if (!normalizedWorkspaceId) {
    return [];
  }
  const prefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  return listAgentEntries(cfg)
    .filter((entry) => entry.id === `bustly-${normalizedWorkspaceId}` || entry.id.startsWith(prefix))
    .map((entry) => entry.id);
}

function applyBustlyWorkspaceCollaborationConfig(
  cfg: OpenClawConfig,
  workspaceId: string,
): OpenClawConfig {
  const workspaceAgentIds = listBustlyWorkspaceAgentIds(cfg, workspaceId);
  if (workspaceAgentIds.length === 0) {
    return cfg;
  }

  const workspaceAgentIdSet = new Set(workspaceAgentIds);
  const allConfiguredBustlyAgentIds = new Set(
    listAgentEntries(cfg)
      .map((entry) => entry.id)
      .filter((agentId) => agentId.startsWith("bustly-")),
  );

  const nextAgentList = listAgentEntries(cfg).map((entry) => {
    if (!workspaceAgentIdSet.has(entry.id)) {
      return entry;
    }
    const nextAllowAgents = workspaceAgentIds.filter((agentId) => agentId !== entry.id);
    return {
      ...entry,
      subagents: {
        ...entry.subagents,
        allowAgents: nextAllowAgents,
      },
    };
  });

  const preservedAllow = (cfg.tools?.agentToAgent?.allow ?? []).filter(
    (entry) => !allConfiguredBustlyAgentIds.has(entry),
  );
  const nextAgentToAgentAllow = Array.from(new Set([...preservedAllow, ...workspaceAgentIds]));

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      list: nextAgentList,
    },
    tools: {
      ...cfg.tools,
      agentToAgent: {
        ...cfg.tools?.agentToAgent,
        enabled: true,
        allow: nextAgentToAgentAllow,
      },
      sessions: {
        ...cfg.tools?.sessions,
        visibility: "all",
      },
    },
  };
}

function resolveBustlyWorkspaceIdFromOAuthState(): string {
  return BustlyOAuth.readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
}

async function hasMissingBustlyWorkspaceSetup(workspaceId: string): Promise<boolean> {
  const cfg = loadConfig();
  const workspaceAgentIds = new Set(listBustlyWorkspaceAgentIds(cfg, workspaceId));
  const mainAgentId = buildBustlyWorkspaceAgentId(workspaceId);
  if (!workspaceAgentIds.has(mainAgentId)) {
    return true;
  }
  const presets = await loadEnabledBustlyRemoteAgentPresets();
  return presets.some((preset) => {
    const agentId = buildBustlyWorkspaceAgentId(workspaceId, preset.slug);
    return !workspaceAgentIds.has(agentId);
  });
}

function setBustlyAgentMetadata(params: {
  workspaceDir: string;
  icon?: string;
}): void {
  const nextIcon = params.icon?.trim();
  if (!nextIcon) {
    return;
  }
  const current = loadBustlyAgentMetadata(params.workspaceDir);
  saveBustlyAgentMetadata(params.workspaceDir, {
    ...current,
    icon: nextIcon,
  });
}

async function ensureBustlyPresetAgents(params: {
  workspaceId: string;
  workspaceName?: string;
}): Promise<void> {
  const presets = await loadEnabledBustlyRemoteAgentPresets();
  for (const preset of presets) {
    if (preset.slug === DEFAULT_BUSTLY_AGENT_NAME || preset.isMain) {
      continue;
    }
    const agentId = buildBustlyWorkspaceAgentId(params.workspaceId, preset.slug);
    const config = loadConfig();
    if (!listAgentEntries(config).some((entry) => entry.id === agentId)) {
      await createBustlyWorkspaceAgent({
        workspaceId: params.workspaceId,
        workspaceName: params.workspaceName,
        agentName: preset.slug,
        displayName: preset.label,
        icon: preset.icon,
      });
      continue;
    }
    const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(params.workspaceId, preset.slug);
    setBustlyAgentMetadata({
      workspaceDir,
      icon: preset.icon,
    });
  }
}

async function ensureBustlyWorkspaceAgentConfig(params: {
  workspaceId: string;
  workspaceName?: string;
  agentName?: string;
}): Promise<{ agentId: string; workspaceDir: string }> {
  const workspaceId = params.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("Bustly workspaceId is required.");
  }
  const agentName = normalizeBustlyAgentName(params.agentName);
  const configPath = resolveElectronConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }

  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName);
  const agentId = buildBustlyWorkspaceAgentId(workspaceId, agentName);
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const providedWorkspaceName = params.workspaceName?.trim();
  const mainPreset = await loadBustlyMainAgentPreset();
  const preset = (await loadBustlyRemoteAgentPresets()).find((entry) => entry.slug === agentName);
  const nextName =
    agentName === DEFAULT_BUSTLY_AGENT_NAME
      ? mainPreset.label
      : preset?.label || providedWorkspaceName || agentName;
  const configWithoutMain =
    listAgentEntries(config).some((entry) => entry.id === "main")
      ? pruneAgentConfig(config, "main").config
      : config;
  const updated = applyAgentConfig(configWithoutMain, {
    agentId,
    name: nextName,
    workspace: workspaceDir,
  });
  const currentList = listAgentEntries(updated);
  const nextList = currentList.map((entry) => ({
    ...entry,
    default: entry.id === agentId,
  }));
  const normalizedNextList = nextList.some((entry) => entry.id === agentId)
    ? nextList
    : [...nextList, { id: agentId, name: nextName, workspace: workspaceDir, default: true }];
  const nextConfig: OpenClawConfig = {
    ...updated,
    agents: {
      ...updated.agents,
      defaults: {
        ...updated.agents?.defaults,
        workspace: workspaceDir,
        skipBootstrap: true,
      },
      list: stripPerAgentSkipBootstrap(normalizedNextList),
    },
  };
  const synchronizedConfig = applyBustlyWorkspaceCollaborationConfig(nextConfig, workspaceId);

  if (JSON.stringify(synchronizedConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(synchronizedConfig, null, 2));
  }

  await initializeBustlyWorkspaceBootstrap({
    workspaceDir,
    workspaceId,
    workspaceName: providedWorkspaceName,
    agentName,
  });
  setBustlyAgentMetadata({
    workspaceDir,
    icon: agentName === DEFAULT_BUSTLY_AGENT_NAME ? mainPreset.icon : preset?.icon,
  });

  await ensureBustlyPresetAgents({
    workspaceId,
    workspaceName: providedWorkspaceName,
  });

  return { agentId, workspaceDir };
}

async function createBustlyWorkspaceAgent(params: {
  workspaceId: string;
  workspaceName?: string;
  agentName: string;
  displayName?: string;
  icon?: string;
}): Promise<{ agentId: string; workspaceDir: string }> {
  const workspaceId = params.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("Bustly workspaceId is required.");
  }
  const agentName = normalizeBustlyAgentName(params.agentName);
  const displayName = params.displayName?.trim() || agentName;
  const icon = params.icon?.trim() || "SquaresFour";
  const configPath = resolveElectronConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }

  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName);
  const agentId = buildBustlyWorkspaceAgentId(workspaceId, agentName);
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;

  if (listAgentEntries(config).some((entry) => entry.id === agentId)) {
    throw new Error(`Agent "${agentName}" already exists in this workspace.`);
  }

  const configWithoutMain =
    listAgentEntries(config).some((entry) => entry.id === "main")
      ? pruneAgentConfig(config, "main").config
      : config;
  const updated = applyAgentConfig(configWithoutMain, {
    agentId,
    name: displayName,
    workspace: workspaceDir,
  });
  const synchronizedConfig = applyBustlyWorkspaceCollaborationConfig({
    ...updated,
    agents: {
      ...updated.agents,
      defaults: {
        ...updated.agents?.defaults,
        skipBootstrap: true,
      },
      list: stripPerAgentSkipBootstrap(updated.agents?.list),
    },
  }, workspaceId);
  if (JSON.stringify(synchronizedConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(synchronizedConfig, null, 2));
  }

  await initializeBustlyWorkspaceBootstrap({
    workspaceDir,
    workspaceId,
    workspaceName: params.workspaceName,
    agentName,
  });
  setBustlyAgentMetadata({
    workspaceDir,
    icon,
  });

  return { agentId, workspaceDir };
}

function listBustlyWorkspaceAgents(workspaceId: string): BustlyWorkspaceAgentSummary[] {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  if (!normalizedWorkspaceId) {
    return [];
  }

  const cfg = loadConfig();
  const prefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  return listAgentEntries(cfg)
    .filter((entry) => entry.id === `bustly-${normalizedWorkspaceId}` || entry.id.startsWith(prefix))
    .map((entry) => {
      const agentId = entry.id;
      const agentName =
        agentId === `bustly-${normalizedWorkspaceId}`
          ? DEFAULT_BUSTLY_AGENT_NAME
          : normalizeBustlyAgentName(agentId.slice(prefix.length) || DEFAULT_BUSTLY_AGENT_NAME);
      const workspaceDir = entry.workspace?.trim() || resolveBustlyWorkspaceAgentWorkspaceDir(normalizedWorkspaceId, agentName);
      const metadata = loadBustlyAgentMetadata(workspaceDir);
      const sessions = listBustlyAgentConversationSessions(agentId);
      const displayName = entry.name?.trim() || agentName;
      return {
        agentId,
        agentName,
        name: displayName,
        icon: metadata.icon,
        isMain: agentName === DEFAULT_BUSTLY_AGENT_NAME,
        updatedAt: sessions[0]?.updatedAt ?? null,
      };
    })
    .sort((left, right) => {
      if (left.isMain && !right.isMain) {
        return -1;
      }
      if (right.isMain && !left.isMain) {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });
}

function listBustlyWorkspaceAgentSessions(params: {
  workspaceId: string;
  agentId: string;
}): BustlyWorkspaceAgentSessionSummary[] {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  if (!normalizedWorkspaceId) {
    return [];
  }
  const agentId = params.agentId.trim();
  if (!agentId.startsWith(buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId))) {
    return [];
  }
  return listBustlyAgentConversationSessions(agentId);
}

async function createBustlyWorkspaceAgentSession(params: {
  workspaceId: string;
  agentId: string;
  label?: string;
}): Promise<BustlyWorkspaceAgentSessionSummary> {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  const agentId = params.agentId.trim();
  const agentPrefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  if (!normalizedWorkspaceId || !agentId.startsWith(agentPrefix)) {
    throw new Error("Agent does not belong to this workspace.");
  }

  const sessionKey = buildBustlyConversationSessionKey(agentId);
  const storePath = resolveDefaultSessionStorePath(agentId);
  const label = params.label?.trim() || "New conversation";
  const updatedAt = Date.now();
  await updateSessionStore(storePath, (store) => {
    store[sessionKey] = {
      sessionId: randomUUID(),
      updatedAt,
      label,
    };
    return store;
  });
  return {
    agentId,
    sessionKey,
    name: label,
    updatedAt,
  };
}

async function updateBustlyWorkspaceAgent(params: {
  workspaceId: string;
  agentId: string;
  displayName?: string;
  icon?: string;
}): Promise<void> {
  const configPath = resolveElectronConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const entry = listAgentEntries(config).find((candidate) => candidate.id === params.agentId);
  if (!entry) {
    throw new Error(`Agent "${params.agentId}" not found.`);
  }

  const nextName = params.displayName?.trim();
  const nextIcon = params.icon?.trim();
  let nextConfig = config;
  if (nextName) {
    nextConfig = applyAgentConfig(nextConfig, {
      agentId: params.agentId,
      name: nextName,
    });
  }
  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
  }

  if (nextIcon) {
    const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
    const agentName = normalizeBustlyAgentName(params.agentId.slice(buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId).length));
    setBustlyAgentMetadata({
      workspaceDir: entry.workspace?.trim() || resolveBustlyWorkspaceAgentWorkspaceDir(normalizedWorkspaceId, agentName),
      icon: nextIcon,
    });
  }
}

async function deleteBustlyWorkspaceAgent(params: {
  workspaceId: string;
  agentId: string;
}): Promise<void> {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  const normalizedAgentId = normalizeAgentId(params.agentId);
  const mainAgentId = buildBustlyWorkspaceAgentId(normalizedWorkspaceId);
  if (normalizedAgentId === mainAgentId) {
    throw new Error("The main workspace agent cannot be deleted.");
  }

  const configPath = resolveElectronConfigPath();
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const entry = listAgentEntries(config).find(
    (candidate) => normalizeAgentId(candidate.id) === normalizedAgentId,
  );
  if (!entry) {
    throw new Error(`Agent "${params.agentId}" not found.`);
  }

  const agentName =
    normalizeBustlyAgentName(
      entry.id.slice(buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId).length),
    ) || DEFAULT_BUSTLY_AGENT_NAME;
  const workspaceDir =
    entry.workspace?.trim() ||
    resolveBustlyWorkspaceAgentWorkspaceDir(normalizedWorkspaceId, agentName);
  const stateDir = resolveElectronStateDir();
  const workspaceAgentsRoot = join(stateDir, "workspaces", normalizedWorkspaceId, "agents");
  const agentStateDir = join(stateDir, "agents", normalizedAgentId);

  const result = pruneAgentConfig(config, entry.id);
  const synchronizedConfig = applyBustlyWorkspaceCollaborationConfig(result.config, normalizedWorkspaceId);
  if (JSON.stringify(synchronizedConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(synchronizedConfig, null, 2));
  }

  removeDirIfWithinRoot(workspaceDir, workspaceAgentsRoot);
  removeDirIfWithinRoot(agentStateDir, join(stateDir, "agents"));
}

async function syncBustlyWorkspaceAgent(params: {
  workspaceId?: string;
  workspaceName?: string;
  agentName?: string;
  forceInit?: boolean;
}): Promise<{ agentId: string; workspaceDir: string } | null> {
  const workspaceId = params.workspaceId?.trim() || resolveBustlyWorkspaceIdFromOAuthState();
  if (!workspaceId) {
    return null;
  }
  const agentName = normalizeBustlyAgentName(params.agentName);
  const configPath = resolveElectronConfigPath();
  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName);
  if (params.forceInit === true || !existsSync(configPath)) {
    const result = await initializeOpenClaw({
      force: params.forceInit === true,
      workspace: workspaceDir,
    });
    if (!result.success) {
      throw new Error(result.error ?? "Failed to initialize OpenClaw");
    }
    initResult = result;
    gatewayPort = result.gatewayPort;
    gatewayBind = result.gatewayBind;
    gatewayToken = result.gatewayToken ?? null;
    needsOnboardAtLaunch = false;
  }
  return await ensureBustlyWorkspaceAgentConfig({
    workspaceId,
    workspaceName: params.workspaceName,
    agentName,
  });
}

async function synchronizeBustlyWorkspaceContext(params?: {
  workspaceId?: string;
  workspaceName?: string;
  agentName?: string;
  selectedModelInput?: string;
  forceInit?: boolean;
}): Promise<{ agentId: string; workspaceDir: string } | null> {
  const agentBinding = await syncBustlyWorkspaceAgent({
    workspaceId: params?.workspaceId,
    workspaceName: params?.workspaceName,
    agentName: params?.agentName,
    forceInit: params?.forceInit,
  });
  syncBustlyConfigFile(resolveElectronConfigPath(), params?.selectedModelInput?.trim());
  return agentBinding;
}

async function setActiveWorkspaceInternal(workspaceId: string, workspaceName?: string): Promise<{
  agentId?: string;
}> {
  const nextWorkspaceId = workspaceId.trim();
  if (!nextWorkspaceId) {
    throw new Error("Missing workspaceId");
  }
  const currentWorkspaceId = BustlyOAuth.readBustlyOAuthState()?.user?.workspaceId?.trim() || "";
  writeMainLog(
    `[Workspace] set active requested current=${currentWorkspaceId || "(none)"} next=${nextWorkspaceId}`,
  );
  if (currentWorkspaceId === nextWorkspaceId) {
    writeMainLog(`[Workspace] set active skipped; already on ${nextWorkspaceId}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("bustly-login-refresh");
    }
    return {};
  }
  BustlyOAuth.setActiveWorkspaceId(nextWorkspaceId);
  syncSentryBustlyScope();
  syncBustlyConfigFile(resolveElectronConfigPath());
  const agentBinding = await synchronizeBustlyWorkspaceContext({
    workspaceId: nextWorkspaceId,
    workspaceName,
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bustly-login-refresh");
  }
  writeMainLog(
    `[Workspace] set active completed next=${nextWorkspaceId} agentId=${agentBinding?.agentId ?? "(none)"}`,
  );
  return {
    agentId: agentBinding?.agentId,
  };
}

function prependPathEntry(pathValue: string, entry: string): string {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const parts = pathValue
    .split(delimiter)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.includes(entry)) {
    parts.unshift(entry);
  }
  return parts.join(delimiter);
}

function prependPathEntries(pathValue: string, entries: Array<string | null | undefined>): string {
  return entries.reduceRight<string>((currentPath, entry) => {
    const normalized = entry?.trim();
    if (!normalized) {
      return currentPath;
    }
    return prependPathEntry(currentPath, normalized);
  }, pathValue);
}

function getPathDelimiter(): string {
  return process.platform === "win32" ? ";" : ":";
}

function loadLoginShellEnvironment(shellPath: string, homeDir: string): Record<string, string> {
  try {
    const result = spawnSync(shellPath, ["-lc", "env -0"], {
      encoding: "buffer",
      env: {
        ...process.env,
        HOME: homeDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0 || !result.stdout) {
      return {};
    }

    const out = result.stdout.toString("utf8");
    const env: Record<string, string> = {};
    for (const entry of out.split("\0")) {
      if (!entry) {
        continue;
      }
      const eq = entry.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = entry.slice(0, eq);
      const value = entry.slice(eq + 1);
      if (!key) {
        continue;
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

function loadElectronEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {};
  const envPaths = [
    process.env.NODE_ENV === "development"
      ? resolve(__dirname, "../.env")
      : resolve(__dirname, "../../.env"),
    resolve(app.getAppPath(), ".env"),
  ];

  for (const envPath of envPaths) {
    try {
      if (!existsSync(envPath)) {
        continue;
      }
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }
        const [key, ...valueParts] = trimmedLine.split("=");
        const value = valueParts.join("=").trim();
        if (key && value) {
          envVars[key] = value;
        }
      }
      writeMainInfo(`[Env] Loaded environment variables from ${envPath}:`, Object.keys(envVars));
      break;
    } catch (error) {
      writeMainError(`[Env] Failed to load ${envPath}:`, error);
    }
  }

  return envVars;
}

function buildElectronCliEnv(params?: {
  cliPath?: string;
  oauthCallbackPort?: number;
}): NodeJS.ProcessEnv {
  const homeDir = app.getPath("home");
  const stateDir = resolveElectronStateDir();
  const appPath = app.getAppPath();
  const resourcesPath = process.resourcesPath || appPath;
  const shellPath = process.env.SHELL?.trim() || "/bin/zsh";
  const loginShellEnv = loadLoginShellEnvironment(shellPath, homeDir);
  const fixedPath =
    loginShellEnv.PATH?.trim() ||
    process.env.PATH?.trim() ||
    "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  const bundledCliShim = params?.cliPath
    ? ensureBundledOpenClawShim(params.cliPath, stateDir, {
      includeBundledNode: true,
      resourcesPath,
      appPath,
    })
    : null;
  const bundledBustlyBinDir = resolveBundledBustlyBinDir({
    resourcesPath,
    appPath,
  });
  const effectivePath = prependPathEntries(fixedPath, [
    bundledCliShim?.shimDir,
    bundledBustlyBinDir,
  ]);
  const bunInstall = process.env.BUN_INSTALL?.trim() || resolve(homeDir, ".bun");
  const homebrewPrefix = process.env.HOMEBREW_PREFIX?.trim() || "/opt/homebrew";
  const bundledSkillsDir = resolve(resourcesPath, "skills");
  const bundledPluginsDir = ensureBundledExtensionsDir({
    resourcesPath,
    appPath,
  });
  const appNodeModules = resolve(appPath, "node_modules");
  const resourcesNodeModules = resolve(resourcesPath, "node_modules");
  const openclawNodeModules = resolve(resourcesPath, "openclaw", "node_modules");
  const inheritedNodePath = process.env.NODE_PATH?.trim();
  const effectiveNodePath =
    [
      openclawNodeModules,
      appNodeModules,
      resourcesNodeModules,
      inheritedNodePath,
    ]
      .filter((value) => Boolean(value && value.length > 0))
      .join(":") || openclawNodeModules;
  const bundledVersion = resolveBundledOpenClawVersion();

  return {
    ...process.env,
    ...loadElectronEnvVars(),
    ...loginShellEnv,
    NODE_ENV: "production",
    OPENCLAW_PROFILE: ELECTRON_OPENCLAW_PROFILE,
    OPENCLAW_BUNDLED_PLUGINS_DIR: bundledPluginsDir,
    ...(existsSync(bundledSkillsDir) ? { OPENCLAW_BUNDLED_SKILLS_DIR: bundledSkillsDir } : {}),
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: resolveElectronConfigPath(),
    OPENCLAW_LOG_FILE: resolveElectronBackendLogPath(),
    HOME: homeDir,
    USERPROFILE: homeDir,
    OPENCLAW_LOAD_SHELL_ENV: "1",
    SHELL: shellPath,
    PATH: effectivePath,
    BUN_INSTALL: bunInstall,
    HOMEBREW_PREFIX: homebrewPrefix,
    TERM: process.env.TERM?.trim() || "xterm-256color",
    COLORTERM: process.env.COLORTERM?.trim() || "truecolor",
    TERM_PROGRAM: process.env.TERM_PROGRAM?.trim() || "OpenClaw",
    NODE_PATH: effectiveNodePath,
    ...(bundledCliShim || bundledBustlyBinDir
      ? {
        OPENCLAW_EXEC_PATH_PREPEND: [
          bundledBustlyBinDir,
          bundledCliShim?.shimDir,
        ]
          .filter((value) => Boolean(value && value.length > 0))
          .join(getPathDelimiter()),
      }
      : {}),
    ...(typeof params?.oauthCallbackPort === "number"
      ? { OPENCLAW_OAUTH_CALLBACK_PORT: String(params.oauthCallbackPort) }
      : {}),
    ...(bundledVersion ? { OPENCLAW_BUNDLED_VERSION: bundledVersion } : {}),
  };
}

function resolveGatewayWorkerPath(): string {
  const candidates = [
    resolve(__dirname, "gateway-worker.js"),
    resolve(__dirname, "gateway-worker-dev.js"),
    resolve(__dirname, "..", "gateway-worker.js"),
    resolve(__dirname, "..", "gateway-worker-dev.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return resolve(__dirname, app.isPackaged ? "gateway-worker.js" : "gateway-worker-dev.js");
}

function sendUpdateStatus(event: string, payload?: Record<string, unknown>) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(UPDATE_STATUS_CHANNEL, { event, ...payload });
  }
}

function logStartupPaths(): void {
  writeMainLog(`cwd=${process.cwd()}`);
  writeMainLog(`__dirname=${__dirname}`);
}

function ensureBundledExtensionsDir(params: {
  resourcesPath: string;
  appPath: string;
}): string {
  // Check if we're in development mode by looking for the project root extensions
  // Try multiple possible paths from the app directory
  const possibleProjectExtensions = [
    // From apps/electron/dist, go up to project root (4 levels: dist -> electron -> apps -> project root)
    resolve(params.appPath, "..", "..", "..", "extensions"),
    // From apps/electron/dist, go up to apps (2 levels: dist -> electron)
    resolve(params.appPath, "..", "..", "extensions"),
    // From apps/electron (if running without dist)
    resolve(params.appPath, "..", "extensions"),
  ];

  for (const projectExtensions of possibleProjectExtensions) {
    if (existsSync(projectExtensions)) {
      writeMainLog(`Using project extensions dir: ${projectExtensions}`);
      return projectExtensions;
    }
  }

  // Production: try bundled extensions in resources
  const bundledDir = resolve(params.resourcesPath, "extensions");
  if (existsSync(bundledDir)) {
    return bundledDir;
  }

  // Development mode: try to find extensions in the project root
  // The app is in apps/electron/dist, so we need to go up 3 levels to reach project root
  const devExtensionsDir = resolve(params.appPath, "..", "..", "..", "extensions");
  if (existsSync(devExtensionsDir)) {
    writeMainLog(`Using development extensions dir: ${devExtensionsDir}`);
    return devExtensionsDir;
  }

  const bundledSource = resolve(params.appPath, "..", "resources", "openclaw", "extensions");
  if (!existsSync(bundledSource)) {
    writeMainLog(`Bundled extensions missing and source not found: ${bundledDir}`);
    return bundledDir;
  }
  try {
    if (!existsSync(bundledDir)) {
      mkdirSync(dirname(bundledDir), { recursive: true });
      cpSync(bundledSource, bundledDir, { recursive: true, dereference: true });
      writeMainLog(`Bundled extensions copied: ${bundledSource} -> ${bundledDir}`);
    }
  } catch (error) {
    writeMainLog(
      `Bundled extensions copy failed: ${bundledSource} -> ${bundledDir} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return bundledDir;
}

function resolveBundledOpenClawVersion(): string | null {
  const candidatePaths = [
    resolve(process.resourcesPath, "openclaw.package.json"),
    resolve(__dirname, "../../../../package.json"),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (!existsSync(candidate)) {
        continue;
      }
      const raw = JSON.parse(readFileSync(candidate, "utf-8")) as { version?: string };
      if (raw.version) {
        return raw.version;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Load gateway configuration from the config file
 */
function loadGatewayConfig(): { port: number; bind: string; token?: string } | null {
  try {
    const configPath = resolveElectronConfigPath();
    if (!existsSync(configPath)) {
      return null;
    }

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const port = config.gateway?.port ?? 17999;
    const bind = config.gateway?.bind ?? "loopback";
    const token = config.gateway?.auth?.token;

    writeMainInfo(`Loaded gateway config: port=${port}, bind=${bind}, auth=${token ? "token" : "none"}`);
    return { port, bind, token };
  } catch (error) {
    writeMainError("Failed to load gateway config:", error);
    return null;
  }
}

function resolveGatewayProbeHost(bind: string): string {
  return bind === "loopback" ? "127.0.0.1" : "0.0.0.0";
}

async function isGatewayPortAvailable(port: number, bind: string): Promise<boolean> {
  const host = resolveGatewayProbeHost(bind);
  return await new Promise<boolean>((resolve) => {
    const server = createServer();
    let settled = false;
    const finish = (available: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        server.close(() => resolve(available));
      } catch {
        resolve(available);
      }
    };
    server.once("error", (error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EADDRINUSE" || code === "EACCES") {
        finish(false);
        return;
      }
      writeMainLog(
        `Gateway port probe failed for ${host}:${port}: ${error instanceof Error ? error.message : String(error)}`,
      );
      finish(false);
    });
    server.once("listening", () => finish(true));
    server.listen(port, host);
  });
}

type ListeningProcessInfo = {
  pid: number;
  command: string;
  descriptors: string[];
};

function inspectListeningProcess(port: number): ListeningProcessInfo | null {
  const lsof = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpct"], {
    encoding: "utf-8",
  });
  if (lsof.status !== 0 || !lsof.stdout) {
    return null;
  }

  let pid = 0;
  let command = "";
  for (const line of lsof.stdout.split("\n")) {
    if (line.startsWith("p")) {
      pid = Number.parseInt(line.slice(1), 10) || 0;
    } else if (line.startsWith("c")) {
      command = line.slice(1).trim();
    }
  }
  if (!pid) {
    return null;
  }

  const details = spawnSync("lsof", ["-nP", "-p", String(pid), "-Fn"], {
    encoding: "utf-8",
  });
  const descriptors =
    details.status === 0 && details.stdout
      ? details.stdout
        .split("\n")
        .filter((line) => line.startsWith("n"))
        .map((line) => line.slice(1).trim())
        .filter(Boolean)
      : [];

  return { pid, command, descriptors };
}

function inspectListeningProcessesInRange(startPort: number, endPort: number): Map<number, ListeningProcessInfo> {
  const listeners = new Map<number, ListeningProcessInfo>();
  for (let port = startPort; port <= endPort; port += 1) {
    const info = inspectListeningProcess(port);
    if (info) {
      listeners.set(info.pid, info);
    }
  }
  return listeners;
}

function isManagedBustlyGatewayProcess(info: ListeningProcessInfo | null): boolean {
  if (!info) {
    return false;
  }
  const haystack = [info.command, ...info.descriptors].join("\n").toLowerCase();
  return (
    haystack.includes("openclaw") &&
    (haystack.includes("/.bustly/") || haystack.includes("gateway.") || haystack.includes("gateway.log"))
  );
}

async function terminateManagedProcess(pid: number): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return false;
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
      await delay(150);
    } catch {
      return true;
    }
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return false;
  }

  const killDeadline = Date.now() + 2_000;
  while (Date.now() < killDeadline) {
    try {
      process.kill(pid, 0);
      await delay(100);
    } catch {
      return true;
    }
  }
  return false;
}

async function reclaimManagedGatewayPorts(params: {
  preferredPort: number;
  bind: string;
  maxAttempts: number;
}): Promise<boolean> {
  const rangeEnd = params.preferredPort + params.maxAttempts;
  const listeners = [...inspectListeningProcessesInRange(params.preferredPort, rangeEnd).values()];
  const managedListeners = listeners.filter((listener) => isManagedBustlyGatewayProcess(listener));

  if (managedListeners.length === 0) {
    return false;
  }

  writeMainLog(
    `[Gateway] Reclaiming managed listeners in port range ${params.preferredPort}-${rangeEnd}: ${managedListeners.map((listener) => `${listener.pid}:${listener.command || "unknown"}`).join(", ")}`,
  );

  let reclaimedAny = false;
  for (const listener of managedListeners) {
    const terminated = await terminateManagedProcess(listener.pid);
    if (terminated) {
      reclaimedAny = true;
      writeMainLog(`[Gateway] Reclaimed managed listener pid=${listener.pid} command=${listener.command || "(unknown)"}`);
    } else {
      writeMainLog(`[Gateway] Failed to terminate managed listener pid=${listener.pid} command=${listener.command || "(unknown)"}`);
    }
  }

  if (!reclaimedAny) {
    return false;
  }

  for (let port = params.preferredPort; port <= rangeEnd; port += 1) {
    if (!(await isGatewayPortAvailable(port, params.bind)) && isManagedBustlyGatewayProcess(inspectListeningProcess(port))) {
      writeMainLog(`[Gateway] Managed listener still detected on port ${port} after reclaim attempt`);
      return false;
    }
  }

  writeMainLog(
    `[Gateway] Reclaim completed for port range ${params.preferredPort}-${rangeEnd}`,
  );
  return true;
}

async function resolveGatewayStartupPort(
  preferredPort: number,
  bind: string,
  maxAttempts = 20,
): Promise<{ port: number; switched: boolean }> {
  if (await isGatewayPortAvailable(preferredPort, bind)) {
    return { port: preferredPort, switched: false };
  }
  if (await reclaimManagedGatewayPorts({ preferredPort, bind, maxAttempts })) {
    return { port: preferredPort, switched: false };
  }
  for (let offset = 1; offset <= maxAttempts; offset += 1) {
    const candidate = preferredPort + offset;
    if (await isGatewayPortAvailable(candidate, bind)) {
      return { port: candidate, switched: true };
    }
  }
  throw new Error(
    `Gateway startup aborted: port ${preferredPort} is occupied and no fallback port in ${preferredPort + 1}-${preferredPort + maxAttempts} is available.`,
  );
}

/**
 * Start the OpenClaw Gateway process
 */
async function startGateway(): Promise<boolean> {
  const oauthCallbackPort = await startOAuthCallbackServer();
  writeMainInfo(`[Bustly] OAuth callback server started on port ${oauthCallbackPort}`);

  const startAt = Date.now();
  if (gatewayProcess) {
    writeMainLog("Gateway already running");
    emitGatewayLifecycle("ready", null);
    return true;
  }

  emitGatewayLifecycle("starting", "Starting gateway...");

  const cliPath = resolveOpenClawCliPath({
    info: (message) => writeMainInfo(message),
    error: (message) => writeMainError(message),
  });
  if (!cliPath) {
    throw new Error("OpenClaw CLI not found");
  }
  const gatewayWorkerPath = resolveGatewayWorkerPath();
  if (!existsSync(gatewayWorkerPath)) {
    throw new Error(`Gateway worker not found at ${gatewayWorkerPath}`);
  }

  writeMainInfo(`Starting gateway with CLI: ${cliPath}`);
  writeMainInfo(`Starting gateway worker: ${gatewayWorkerPath}`);

  // Try to load config first, otherwise use initialization result or defaults
  const loadedConfig = loadGatewayConfig();
  if (loadedConfig) {
    gatewayPort = loadedConfig.port;
    gatewayBind = loadedConfig.bind;
    // Ensure token is loaded
    if (loadedConfig.token) {
      gatewayToken = loadedConfig.token;
    }
  } else if (initResult) {
    gatewayPort = initResult.gatewayPort;
    gatewayBind = initResult.gatewayBind;
    if (initResult.gatewayToken) {
      gatewayToken = initResult.gatewayToken;
    }
  }

  const preferredGatewayPort = gatewayPort;
  const { port: selectedGatewayPort, switched } = await resolveGatewayStartupPort(
    preferredGatewayPort,
    gatewayBind,
  );
  if (switched) {
    const warning = `Preferred gateway port ${preferredGatewayPort} is occupied; switching to ${selectedGatewayPort}.`;
    writeMainWarn(`[Gateway] ${warning}`);
  }
  gatewayPort = selectedGatewayPort;

  return await new Promise((resolvePromise, reject) => {
    writeMainInfo(`Starting gateway on port ${gatewayPort} with bind=${gatewayBind}`);
    writeMainInfo(`Authentication: ${loadedConfig?.token ? "token" : "none (local development mode)"}`);

    // Store token for WS URL
    if (gatewayToken) {
      writeMainInfo(`Using token: ${gatewayToken.slice(0, 8)}...`);
    }

    const recentStdout: string[] = [];
    const recentStderr: string[] = [];
    const pushRecent = (buffer: string[], line: string) => {
      buffer.push(line);
      if (buffer.length > 50) {
        buffer.shift();
      }
    };

    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath || appPath;
    const bundledPluginsDir = ensureBundledExtensionsDir({
      resourcesPath,
      appPath,
    });
    const bundledSkillsDir = resolve(resourcesPath, "skills");
    writeMainLog(`Bundled skills dir: ${bundledSkillsDir}`);
    const bundledVersion = resolveBundledOpenClawVersion();
    if (bundledVersion) {
      writeMainLog(`Bundled OpenClaw version: ${bundledVersion}`);
    }
    const homeDir = app.getPath("home");
    const stateDir = resolveElectronStateDir();
    const shellPath = process.env.SHELL?.trim() || "/bin/zsh";
    const loginShellEnv = loadLoginShellEnvironment(shellPath, homeDir);
    const fixedPath =
      loginShellEnv.PATH?.trim() ||
      process.env.PATH?.trim() ||
      "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
    const bundledCliShim = ensureBundledOpenClawShim(cliPath, stateDir, {
      includeBundledNode: true,
      resourcesPath,
      appPath,
    });
    const bundledBustlyBinDir = resolveBundledBustlyBinDir({
      resourcesPath,
      appPath,
    });
    const effectivePath = prependPathEntries(fixedPath, [
      bundledCliShim?.shimDir,
      bundledBustlyBinDir,
    ]);
    const appNodeModules = resolve(appPath, "node_modules");
    const resourcesNodeModules = resolve(resourcesPath, "node_modules");
    const openclawNodeModules = resolve(resourcesPath, "openclaw", "node_modules");
    const inheritedNodePath = process.env.NODE_PATH?.trim();
    const nodePathCandidates = [
      openclawNodeModules,
      appNodeModules,
      resourcesNodeModules,
      inheritedNodePath,
    ];
    const combinedNodePath = nodePathCandidates
      .filter((value) => Boolean(value && value.length > 0))
      .join(":");
    const effectiveNodePath = combinedNodePath || openclawNodeModules;
    const nodePathStatus = nodePathCandidates
      .filter((value) => Boolean(value && value.length > 0))
      .map((value) => `${value}(${existsSync(value!) ? "exists" : "missing"})`)
      .join(" | ");
    const nodePath = resolveNodeBinary({ includeBundled: true });
    if (!nodePath) {
      writeMainLog("Failed to locate node binary in bundled resources.");
      reject(new Error("Node binary not found for gateway worker"));
      return;
    }
    try {
      const nodeVersion = spawnSync(nodePath, ["-v"], { encoding: "utf-8" }).stdout?.trim();
      const nodeArch = spawnSync(nodePath, ["-p", "process.arch"], { encoding: "utf-8" })
        .stdout?.trim();
      writeMainLog(
        `Gateway node runtime: path=${nodePath} version=${nodeVersion ?? "unknown"} arch=${nodeArch ?? "unknown"}`,
      );
    } catch (error) {
      writeMainLog(
        `Gateway node runtime probe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const spawnEnv = buildElectronCliEnv({ cliPath, oauthCallbackPort });
    if (existsSync(bundledPluginsDir)) {
      spawnEnv.OPENCLAW_BUNDLED_PLUGINS_DIR = bundledPluginsDir;
    }
    spawnEnv.OPENCLAW_GATEWAY_PORT = String(gatewayPort);
    spawnEnv.OPENCLAW_ELECTRON_GATEWAY_BIND = gatewayBind;
    if (gatewayToken) {
      spawnEnv.OPENCLAW_GATEWAY_TOKEN = gatewayToken;
    } else {
      delete spawnEnv.OPENCLAW_GATEWAY_TOKEN;
    }
    writeMainLog(
      `Gateway env: SHELL=${shellPath} OPENCLAW_LOAD_SHELL_ENV=1 NODE_PATH=${effectiveNodePath || "(empty)"} PATH_HEAD=${effectivePath.split(getPathDelimiter())[0] ?? "(empty)"} cliShim=${bundledCliShim?.shimPath ?? "(none)"} appPath=${appPath} resourcesPath=${resourcesPath} candidates=${nodePathStatus || "(none)"} rawOpenClawNodeModules=${openclawNodeModules} rawResourcesNodeModules=${resourcesNodeModules} rawAppNodeModules=${appNodeModules} inheritedNodePath=${inheritedNodePath ?? "(none)"} worker=${gatewayWorkerPath}`,
    );

    writeMainLog(
      `Gateway fork: execPath=${nodePath} module=${gatewayWorkerPath} port=${gatewayPort} bind=${gatewayBind}`,
    );
    gatewayProcess = fork(gatewayWorkerPath, [], {
      env: spawnEnv,
      execPath: nodePath,
      silent: true,
    });

    gatewayProcess.stdout?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        pushRecent(recentStdout, output);
        writeMainLog(`Gateway stdout: ${output}`);
      }
      mainWindow?.webContents.send("gateway-log", { stream: "stdout", message: output });
    });

    gatewayProcess.stderr?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        pushRecent(recentStderr, output);
        writeMainLog(`Gateway stderr: ${output}`);
      }
      mainWindow?.webContents.send("gateway-log", { stream: "stderr", message: output });
    });

    gatewayProcess.on("error", (error) => {
      writeMainError("[Gateway error]:", error);
      gatewayProcess = null;
      reject(error);
    });

    gatewayProcess.on("exit", (code, signal) => {
      writeMainLog(
        `Gateway exited during startup: code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
      if (recentStderr.length > 0) {
        writeMainLog(`Gateway stderr tail:\n${recentStderr.join("\n")}`);
      } else if (recentStdout.length > 0) {
        writeMainLog(`Gateway stdout tail:\n${recentStdout.join("\n")}`);
      }
      gatewayProcess = null;
      mainWindow?.webContents.send("gateway-exit", { code, signal });
    });

    const exitPromise = new Promise<never>((_resolve, rejectExit) => {
      gatewayProcess?.once("exit", (code, signal) => {
        rejectExit(
          new Error(`Gateway exited during startup: code=${code ?? "null"} signal=${signal ?? "null"}`),
        );
      });
    });
    const readyPromise = (async () => {
      const ready = await waitForGatewayPort(gatewayPort, null);
      if (!ready) {
        throw new Error(`Gateway port ${gatewayPort} not ready`);
      }
      return true;
    })();

    Promise.race([readyPromise, exitPromise])
      .then(() => {
        const elapsedMs = Date.now() - startAt;
        writeMainLog(`Gateway startup ready in ${elapsedMs}ms`);
        emitGatewayLifecycle("ready", null);
        resolvePromise(true);
      })
      .catch((error) => {
        const elapsedMs = Date.now() - startAt;
        writeMainLog(`Gateway startup failed after ${elapsedMs}ms`);
        const stderrTail = recentStderr.length > 0 ? recentStderr.join("\n") : "";
        const stdoutTail = recentStdout.length > 0 ? recentStdout.join("\n") : "";
        if (stderrTail) {
          writeMainLog(`Gateway startup stderr:\n${stderrTail}`);
        } else if (stdoutTail) {
          writeMainLog(`Gateway startup stdout:\n${stdoutTail}`);
        }
        if (gatewayProcess && !gatewayProcess.killed) {
          gatewayProcess.kill("SIGTERM");
        }
        emitGatewayLifecycle(
          "error",
          error instanceof Error ? error.message : String(error),
        );
        reject(error);
      });
  });
}

/**
 * Stop the OpenClaw Gateway process
 */
function stopGateway(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!gatewayProcess) {
      writeMainInfo("Gateway not running");
      resolve(true);
      return;
    }

    writeMainInfo("Stopping gateway");
    emitGatewayLifecycle("stopping", "Restarting gateway...");

    gatewayProcess.kill("SIGTERM");

    // Force kill after 5 seconds
    const timeout = setTimeout(() => {
      if (gatewayProcess && !gatewayProcess.killed) {
        writeMainWarn("Force killing gateway");
        gatewayProcess.kill("SIGKILL");
      }
    }, 5000);

    gatewayProcess.on("exit", () => {
      clearTimeout(timeout);
      gatewayProcess = null;
      writeMainInfo("Gateway stopped");
      resolve(true);
    });
  });
}

function buildControlUiUrl(params: { port: number; token?: string | null }) {
  const baseUrl = `http://127.0.0.1:${params.port}`;
  if (!params.token) {
    return baseUrl;
  }
  return `${baseUrl}?token=${params.token}`;
}

async function waitForGatewayPort(port: number, timeoutMs: number | null = 20_000): Promise<boolean> {
  const start = Date.now();
  while (timeoutMs === null || Date.now() - start < timeoutMs) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = new Socket();
      const onDone = (result: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(1_000);
      socket.once("connect", () => onDone(true));
      socket.once("timeout", () => onDone(false));
      socket.once("error", () => onDone(false));
      socket.connect(port, "127.0.0.1");
    });
    if (ready) {
      return true;
    }
    await delay(250);
  }
  return false;
}

function openControlUiInMainWindow(): void {
  const controlUrl = buildControlUiUrl({ port: gatewayPort, token: gatewayToken });
  writeMainLog(
    `Opening Control UI: url=${controlUrl} token=${gatewayToken ? "present" : "missing"}`,
  );
  
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const webContents = mainWindow.webContents;
  const logLoadFailure = (
    _event: unknown,
    errorCode: number,
    errorDescription: string,
    validatedUrl: string,
    isMainFrame: boolean,
  ) => {
    if (!isMainFrame) {
      return;
    }
    writeMainLog(
      `Control UI load failed: code=${errorCode} url=${validatedUrl} error=${errorDescription}`,
    );
  };
  webContents.on("did-fail-load", logLoadFailure);
  webContents.on("did-finish-load", () => {
    const url = webContents.getURL();
    writeMainLog(`Control UI load finished: url=${url}`);
  });
  webContents.on("did-navigate", (_event, url) => {
    writeMainLog(`Control UI navigated: url=${url}`);
  });

  void waitForGatewayPort(gatewayPort).then((ready) => {
    writeMainLog(`Gateway port ${gatewayPort} ready=${ready}`);
    if (!ready || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.loadURL(controlUrl).catch((error) => {
      writeMainLog(`Control UI loadURL failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
}

function openBustlyLoginInMainWindow(): void {
  writeMainLog("[Bustly Login] Opening login page in main window");
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  loadRendererWindow(mainWindow, { hash: BUSTLY_LOGIN_HASH });
}

function resolveOpenClawConfigPath(): string {
  return resolveElectronConfigPath();
}

function readGatewayTokenFromConfig(): string | null {
  try {
    const configPath = resolveOpenClawConfigPath();
    if (!existsSync(configPath)) {
      return null;
    }
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as {
      gateway?: { auth?: { token?: unknown } };
    };
    const token = raw?.gateway?.auth?.token;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

async function withPrivilegedGatewayClient<T>(
  request: (client: GatewayClient) => Promise<T>,
): Promise<T> {
  const token = readGatewayTokenFromConfig() ?? gatewayToken;
  const url = token
    ? `ws://${GATEWAY_HOST}:${gatewayPort}?token=${token}`
    : `ws://${GATEWAY_HOST}:${gatewayPort}`;

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    let client: GatewayClient | null = null;

    const finish = (error?: unknown, value?: T) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      client?.stop();
      if (error) {
        const message =
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : JSON.stringify(error);
        reject(error instanceof Error ? error : new Error(message || "Unknown gateway error"));
        return;
      }
      resolve(value as T);
    };

    const timer = setTimeout(() => {
      finish(new Error("gateway connect timeout"));
    }, 10_000);

    client = new GatewayClient({
      url,
      token: token ?? undefined,
      connectDelayMs: 0,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: "Bustly Electron",
      clientVersion: app.getVersion(),
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      role: "operator",
      scopes: ["operator.admin"],
      instanceId: `bustly-electron-main-${randomUUID()}`,
      onHelloOk: () => {
        void request(client as GatewayClient).then(
          (result) => finish(undefined, result),
          (error) => finish(error),
        );
      },
      onConnectError: (error) => finish(error),
      onClose: (code, reason) => {
        finish(new Error(`gateway closed during request (${code}): ${reason}`));
      },
    });

    client.start();
  });
}

function loadRendererWindow(targetWindow: BrowserWindow, options?: { hash?: string }) {
  if (process.env.NODE_ENV === "development") {
    const url = options?.hash ? `http://localhost:5180/#${options.hash}` : "http://localhost:5180";
    targetWindow.loadURL(url).catch((error) => {
      writeMainLog(`Renderer load failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  } else {
    const filePath = resolve(__dirname, "../renderer/index.html");
    const loadOptions = options?.hash ? { hash: options.hash } : undefined;
    targetWindow.loadFile(filePath, loadOptions).catch((error) => {
      writeMainLog(`Renderer load failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

/**
 * Create the main browser window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#ffffff",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Preload is always in dist/main/preload.js
      // In dev: __dirname = "dist/", so "main/preload.js" = "dist/main/preload.js"
      // In prod: __dirname = "dist/main/", so "preload.js" = "dist/main/preload.js"
      preload: PRELOAD_PATH,
    },
    title: APP_DISPLAY_NAME,
  });

  // Load the app
  if (process.env.NODE_ENV === "development") {
    loadRendererWindow(mainWindow);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    loadRendererWindow(mainWindow);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("enter-full-screen", () => {
    sendNativeFullscreenState(true);
  });

  mainWindow.on("leave-full-screen", () => {
    sendNativeFullscreenState(false);
  });

  mainWindow.on("focus", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    void (async () => {
      const loggedIn = await BustlyOAuth.verifyBustlyLoginStatus();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      if (!loggedIn) {
        mainWindow.webContents.send("bustly-login-refresh");
      }
    })();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    sendNativeFullscreenState(Boolean(mainWindow?.isFullScreen()));
    flushPendingDeepLink();
  });
  flushPendingDeepLink();
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    writeMainLog("[Updater] Development mode: auto-updates enabled");
  }

  const updateUrl =
    process.env.BUSTLY_UPDATE_URL?.trim();
  const updateBaseUrl =
    process.env.BUSTLY_UPDATE_BASE_URL?.trim();

  const platformKey =
    process.platform === "darwin"
      ? `mac-${process.arch === "arm64" ? "arm64" : "x64"}`
      : process.platform === "win32"
        ? "windows"
        : "linux";
  const normalizeBase = (input: string) => input.replace(/\/+$/, "");
  const buildPlatformUrl = (base: string) => `${normalizeBase(base)}/${platformKey}/`;
  const resolvedUpdateUrl = updateUrl || (updateBaseUrl ? buildPlatformUrl(updateBaseUrl) : "");

  const appVersion = app.getVersion();
  const prerelease = appVersion.includes("-") ? appVersion.split("-")[1] ?? "" : "";
  const inferredChannel = prerelease ? prerelease.split(".")[0] ?? "latest" : "latest";
  autoUpdater.channel = inferredChannel;
  const channel = autoUpdater.channel ?? inferredChannel;
  const metadataFile =
    process.platform === "darwin"
      ? (channel === "latest" ? "latest-mac.yml" : `${channel}-mac.yml`)
      : channel === "latest"
        ? "latest.yml"
        : `${channel}.yml`;

  writeMainLog(`[Updater] App version: ${appVersion}`);
  writeMainLog(`[Updater] Channel: ${channel} metadata: ${metadataFile}`);

  if (channel !== "latest") {
    autoUpdater.allowPrerelease = true;
    writeMainLog("[Updater] allowPrerelease enabled");
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // macOS + generic provider has shown flaky partial installs in our env;
  // force full package downloads instead of differential/blockmap patches.
  autoUpdater.disableDifferentialDownload = true;
  writeMainLog("[Updater] Differential download disabled");

  if (resolvedUpdateUrl) {
    try {
      autoUpdater.setFeedURL({ provider: "generic", url: resolvedUpdateUrl });
      writeMainLog(`[Updater] Feed URL set: ${resolvedUpdateUrl}`);
    } catch (error) {
      writeMainLog(`[Updater] Failed to set feed URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    writeMainLog("[Updater] No update URL configured; using electron-builder publish config");
  }

  autoUpdater.on("checking-for-update", () => {
    writeMainLog("[Updater] Checking for updates...");
    sendUpdateStatus("checking");
  });

  autoUpdater.on("update-available", (info) => {
    writeMainLog(`[Updater] Update available: ${info.version}`);
    sendUpdateStatus("available", { info });
  });

  autoUpdater.on("update-not-available", (info) => {
    writeMainLog(`[Updater] No updates available (current: ${info.version})`);
    sendUpdateStatus("not-available", { info });
  });

  autoUpdater.on("error", (error) => {
    writeMainLog(`[Updater] Error: ${error instanceof Error ? error.message : String(error)}`);
    sendUpdateStatus("error", { error: error instanceof Error ? error.message : String(error) });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus("download-progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    writeMainLog(`[Updater] Update downloaded: ${info.version}`);
    sendUpdateStatus("downloaded", { info });
    updateReady = true;
    updateVersion = info.version ?? null;
  });

  const runStartupUpdateCheck = async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo?.version) {
        writeMainLog(`[Updater] checkForUpdates result: ${result.updateInfo.version}`);
      } else {
        writeMainLog("[Updater] checkForUpdates result: no update info");
      }

      const downloadPromise = result?.downloadPromise;
      if (downloadPromise && typeof downloadPromise.catch === "function") {
        void downloadPromise.catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          writeMainLog(`[Updater] background download failed: ${message}`);
          sendUpdateStatus("error", { error: message });
        });
      }
    } catch (error) {
      writeMainLog(`[Updater] checkForUpdates failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Never let update probing block the app startup path.
  setTimeout(() => {
    void runStartupUpdateCheck();
  }, 3000);
}

function ensureWindow(): void {
  if (app.isReady()) {
    createWindow();
    return;
  }
  app.once("ready", () => createWindow());
}

async function ensureElectronBootstrapModel(): Promise<void> {
  const openrouterApiKey = getElectronOpenrouterApiKey();
  if (!openrouterApiKey) {
    return;
  }

  const configPath = resolveElectronConfigPath();
  if (!existsSync(configPath)) {
    return;
  }

  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const currentModel = config.agents?.defaults?.model;
  const primaryModel = typeof currentModel === "string" ? currentModel : currentModel?.primary;

  await setOpenrouterApiKey(openrouterApiKey, resolveOpenClawAgentDir());
  let nextConfig = applyOpenrouterProviderConfig(config);
  nextConfig = applyAuthProfileConfig(nextConfig, {
    profileId: "openrouter:default",
    provider: "openrouter",
    mode: "api_key",
  });
  if (!primaryModel?.trim() || primaryModel !== ELECTRON_DEFAULT_MODEL) {
    nextConfig = applyPrimaryModel(nextConfig, ELECTRON_DEFAULT_MODEL);
  }
  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
    writeMainLog(`[Init] Applied beta bootstrap model ${ELECTRON_DEFAULT_MODEL}`);
  }
}

async function bootstrapDesktopSession(options?: {
  forceInit?: boolean;
  model?: string;
  openControlUi?: boolean;
}): Promise<void> {
  await synchronizeBustlyWorkspaceContext({
    selectedModelInput: options?.model,
    forceInit: options?.forceInit === true,
  });
  const existingConfig = loadGatewayConfig();
  if (existingConfig) {
    gatewayPort = existingConfig.port;
    gatewayBind = existingConfig.bind;
    gatewayToken = existingConfig.token ?? null;
  }
  await ensureElectronBootstrapModel();
  await startGateway();

  if (options?.openControlUi === true) {
    openControlUiInMainWindow();
  }
}

/**
 * Setup IPC handlers
 */
function setupIpcHandlers(): void {
  // Initialize OpenClaw
  ipcMain.handle("openclaw-init", async (_event, options?) => {
    try {
      const result = await initializeOpenClaw(options);
      if (result.success) {
        initResult = result;
        gatewayPort = result.gatewayPort;
        gatewayBind = result.gatewayBind;
        gatewayToken = result.gatewayToken ?? null;
        needsOnboardAtLaunch = false;
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Check if initialized
  ipcMain.handle("openclaw-is-initialized", () => {
    return isFullyInitialized();
  });

  // Whether this launch needs onboarding (computed on app start)
  ipcMain.handle("openclaw-needs-onboard", () => {
    const initialized = isFullyInitialized();
    writeMainLog(`[Init] needsOnboardAtLaunch=${needsOnboardAtLaunch} initialized=${initialized}`);
    if (initialized && needsOnboardAtLaunch) {
      needsOnboardAtLaunch = false;
    }
    return needsOnboardAtLaunch && !initialized;
  });

  // Start gateway
  ipcMain.handle("gateway-start", async (_event, apiKey?: string) => {
    try {
      if (!isFullyInitialized()) {
        return { success: false, error: "OpenClaw is not onboarded yet." };
      }
      // If API key is provided, re-initialize config with the API key
      if (apiKey && apiKey.trim()) {
        writeMainInfo("[Gateway] Re-initializing with API key...");
        const workspaceId = resolveBustlyWorkspaceIdFromOAuthState();
        const result = await initializeOpenClaw({
          force: true,
          openrouterApiKey: apiKey.trim(),
          workspace: workspaceId ? resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId) : undefined,
        });
        if (result.success) {
          initResult = result;
          gatewayPort = result.gatewayPort;
          gatewayBind = result.gatewayBind;
          if (result.gatewayToken) {
            gatewayToken = result.gatewayToken;
          }
        } else {
          return { success: false, error: result.error ?? "Failed to initialize config" };
        }
      }

      await startGateway();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Stop gateway
  ipcMain.handle("gateway-stop", async () => {
    try {
      await stopGateway();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get gateway status
  ipcMain.handle("gateway-status", () => {
    const configToken = readGatewayTokenFromConfig();
    const token = configToken ?? gatewayToken;
    const wsUrl = token
      ? `ws://${GATEWAY_HOST}:${gatewayPort}?token=${token}`
      : `ws://${GATEWAY_HOST}:${gatewayPort}`;

    return {
      running: gatewayProcess !== null && !gatewayProcess.killed,
      pid: gatewayProcess?.pid ?? null,
      port: gatewayPort,
      host: GATEWAY_HOST,
      bind: gatewayBind,
      wsUrl,
      initialized: isFullyInitialized(),
    };
  });

  ipcMain.handle("gateway-connect-config", () => {
    const configToken = readGatewayTokenFromConfig();
    const token = configToken ?? gatewayToken;
    const wsUrl = token
      ? `ws://${GATEWAY_HOST}:${gatewayPort}?token=${token}`
      : `ws://${GATEWAY_HOST}:${gatewayPort}`;
    writeMainInfo(
      `[Gateway Token] connect-config configPath=${resolveOpenClawConfigPath()} configToken=${configToken ? `${configToken.slice(0, 8)}...` : "(missing)"} cachedToken=${gatewayToken ? `${gatewayToken.slice(0, 8)}...` : "(missing)"} chosen=${token ? `${token.slice(0, 8)}...` : "(missing)"}`,
    );
    return {
      wsUrl,
      token,
      host: GATEWAY_HOST,
      port: gatewayPort,
    };
  });

  ipcMain.handle(
    "gateway-patch-session",
    async (_event, key: string, patch: { label?: string | null; icon?: string | null }) => {
      try {
        const normalizedKey = typeof key === "string" ? key.trim() : "";
        if (!normalizedKey) {
          return { success: false, error: "Session key is required." };
        }

        const nextPatch: { key: string; label?: string | null; icon?: string | null } = { key: normalizedKey };
        if (patch && "label" in patch) {
          if (patch.label === null) {
            nextPatch.label = null;
          } else {
            const normalizedLabel = typeof patch.label === "string" ? patch.label.trim() : "";
            if (!normalizedLabel) {
              return { success: false, error: "Scenario name is required." };
            }
            nextPatch.label = normalizedLabel;
          }
        }
        if (patch && "icon" in patch) {
          if (patch.icon === null) {
            nextPatch.icon = null;
          } else {
            const normalizedIcon = typeof patch.icon === "string" ? patch.icon.trim() : "";
            if (!normalizedIcon) {
              return { success: false, error: "Scenario icon is required." };
            }
            nextPatch.icon = normalizedIcon;
          }
        }
        if (!("label" in nextPatch) && !("icon" in nextPatch)) {
          return { success: false, error: "At least one session field is required." };
        }

        const result = await withPrivilegedGatewayClient((client) =>
          client.request<SessionsPatchResult>("sessions.patch", nextPatch),
        );
        if (!result?.ok) {
          return { success: false, error: "Failed to update scenario." };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle("gateway-patch-session-label", async (_event, key: string, label: string) => {
    try {
      const normalizedKey = typeof key === "string" ? key.trim() : "";
      const normalizedLabel = typeof label === "string" ? label.trim() : "";
      if (!normalizedKey) {
        return { success: false, error: "Session key is required." };
      }
      if (!normalizedLabel) {
        return { success: false, error: "Scenario name is required." };
      }

      const result = await withPrivilegedGatewayClient((client) =>
        client.request<SessionsPatchResult>("sessions.patch", {
          key: normalizedKey,
          label: normalizedLabel,
        }),
      );
      if (!result?.ok) {
        return { success: false, error: "Failed to rename scenario." };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("gateway-patch-session-model", async (_event, key: string, model: string) => {
    try {
      const normalizedKey = typeof key === "string" ? key.trim() : "";
      if (!normalizedKey) {
        return { success: false, error: "Session key is required." };
      }
      const normalizedModel = normalizeBustlyModelRef(model);

      const result = await withPrivilegedGatewayClient((client) =>
        client.request<SessionsPatchResult>("sessions.patch", {
          key: normalizedKey,
          model: normalizedModel,
        })
      );
      if (!result?.ok) {
        return { success: false, error: "Failed to set model for this scenario." };
      }
      return {
        success: true,
        model: result.resolved?.model ?? normalizedModel,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("gateway-delete-session", async (_event, key: string) => {
    try {
      const normalizedKey = typeof key === "string" ? key.trim() : "";
      if (!normalizedKey) {
        return { success: false, error: "Session key is required." };
      }

      const result = await withPrivilegedGatewayClient((client) =>
        client.request<{ ok?: boolean; deleted?: boolean }>("sessions.delete", {
          key: normalizedKey,
        })
      );
      if (!result?.ok) {
        return { success: false, error: "Failed to delete session." };
      }
      if (result.deleted !== true) {
        return { success: false, error: "Session was not deleted." };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("resolve-pasted-path", (_event, params) => {
    const payload =
      params && typeof params === "object"
        ? (params as {
            directPath?: string;
            entryPath?: string;
            entryName?: string;
            transferPaths?: string[];
            fallbackKind?: "file" | "directory";
          })
        : {};
    return resolvePastedPath({
      directPath: payload.directPath,
      entryPath: payload.entryPath,
      entryName: payload.entryName,
      transferPaths: payload.transferPaths,
      fallbackKind: payload.fallbackKind === "directory" ? "directory" : "file",
    });
  });

  ipcMain.handle("dialog-select-chat-context-paths", async () => {
    const dialogOptions: OpenDialogOptions = {
      title: "Select files or folders",
      properties: ["openFile", "openDirectory", "multiSelections"],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }
    return result.filePaths.map((selectedPath) => {
      let isDirectory = false;
      try {
        isDirectory = statSync(selectedPath).isDirectory();
      } catch {
        isDirectory = false;
      }
      let imageUrl: string | undefined;
      if (!isDirectory && IMAGE_PREVIEW_EXT_RE.test(selectedPath)) {
        try {
          const mimeType = resolveImagePreviewMimeType(selectedPath);
          if (mimeType) {
            const base64 = readFileSync(selectedPath).toString("base64");
            imageUrl = `data:${mimeType};base64,${base64}`;
          }
        } catch {
          imageUrl = undefined;
        }
      }
      return {
        path: selectedPath,
        name: basename(selectedPath) || selectedPath,
        kind: isDirectory ? ("directory" as const) : ("file" as const),
        imageUrl,
      };
    });
  });

  ipcMain.handle("resolve-chat-image-preview", async (_event, rawPath: string) => {
    const targetPath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!targetPath || !IMAGE_PREVIEW_EXT_RE.test(targetPath)) {
      return null;
    }
    try {
      const mimeType = resolveImagePreviewMimeType(targetPath);
      if (!mimeType) {
        return null;
      }
      const base64 = readFileSync(targetPath).toString("base64");
      return `data:${mimeType};base64,${base64}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle("open-local-path", async (_event, rawPath: string) => {
    const targetPath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!isOpenableLocalPath(targetPath)) {
      return { success: false, error: "Expected an openable local path." };
    }
    try {
      const error = await shell.openPath(resolveOpenableLocalPath(targetPath));
      if (error) {
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get app info
  ipcMain.handle("get-app-info", () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    };
  });

  ipcMain.handle("window-native-fullscreen-status", () => {
    return { isNativeFullscreen: Boolean(mainWindow?.isFullScreen()) };
  });

  ipcMain.handle("updater-check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const downloadPromise = result?.downloadPromise;
      if (downloadPromise && typeof downloadPromise.catch === "function") {
        void downloadPromise.catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          writeMainLog(`[Updater] manual download failed: ${message}`);
          sendUpdateStatus("error", { error: message });
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("updater-install", () => {
    try {
      writeMainLog("[Updater] updater-install requested");
      sendUpdateStatus("installing", { version: updateVersion });
      updateInstalling = true;
      setTimeout(() => {
        writeMainLog("[Updater] Calling quitAndInstall");
        autoUpdater.quitAndInstall(false, true);
      }, 2000);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("updater-status", () => {
    return {
      ready: updateReady,
      version: updateVersion,
    };
  });

  // === Onboarding handlers ===

  // === Bustly OAuth handlers ===

  // Check if user is logged in to Bustly
  ipcMain.handle("bustly-is-logged-in", async () => {
    return await BustlyOAuth.isBustlyLoggedIn();
  });

  // Get current Bustly user info
  ipcMain.handle("bustly-get-user-info", async () => {
    return await BustlyOAuth.getBustlyUserInfo();
  });

  ipcMain.handle("bustly-get-supabase-config", async () => {
    const state = BustlyOAuth.readBustlyOAuthState();
    const supabase = state?.supabase;
    const user = state?.user;
    const accessToken = user?.userAccessToken?.trim() || "";
    const workspaceId = user?.workspaceId?.trim() || "";
    if (!supabase?.url || !supabase.anonKey || !accessToken) {
      return null;
    }
    return {
      url: supabase.url,
      anonKey: supabase.anonKey,
      accessToken,
      workspaceId,
      userId: user?.userId || "",
      userEmail: user?.userEmail || "",
      userName: user?.userName || "",
    };
  });

  ipcMain.handle(
    "bustly-set-active-workspace",
    async (_event, workspaceId: string, workspaceName?: string) => {
    try {
      const agentBinding = await setActiveWorkspaceInternal(workspaceId, workspaceName);
      return {
        success: true,
        agentId: agentBinding?.agentId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    },
  );

  ipcMain.handle("bustly-list-agents", async (_event, workspaceId?: string) => {
    try {
      const nextWorkspaceId = workspaceId?.trim() || resolveBustlyWorkspaceIdFromOAuthState();
      if (!nextWorkspaceId) {
        return [];
      }
      return listBustlyWorkspaceAgents(nextWorkspaceId);
    } catch {
      return [];
    }
  });

  ipcMain.handle("bustly-list-agent-sessions", async (_event, workspaceId: string, agentId: string) => {
    try {
      return listBustlyWorkspaceAgentSessions({ workspaceId, agentId });
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    "bustly-create-agent",
    async (
      _event,
      workspaceId: string,
      name: string,
      icon?: string,
      workspaceName?: string,
    ) => {
      try {
        const trimmedName = typeof name === "string" ? name.trim() : "";
        if (!trimmedName) {
          return { success: false, error: "Agent name is required." };
        }
        const result = await createBustlyWorkspaceAgent({
          workspaceId,
          workspaceName,
          agentName: trimmedName,
          displayName: trimmedName,
          icon,
        });
        return {
          success: true,
          agentId: result.agentId,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    "bustly-create-agent-session",
    async (
      _event,
      params: { workspaceId: string; agentId: string; label?: string },
    ) => {
      try {
        const result = await createBustlyWorkspaceAgentSession(params);
        return {
          success: true,
          sessionKey: result.sessionKey,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    "bustly-update-agent",
    async (
      _event,
      params: { workspaceId: string; agentId: string; name?: string; icon?: string },
    ) => {
      try {
        await updateBustlyWorkspaceAgent({
          workspaceId: params.workspaceId,
          agentId: params.agentId,
          displayName: params.name,
          icon: params.icon,
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    "bustly-delete-agent",
    async (_event, params: { workspaceId: string; agentId: string }) => {
      try {
        await deleteBustlyWorkspaceAgent(params);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // Open Bustly login page (standalone)
  ipcMain.handle("bustly-open-login", () => {
    try {
      openBustlyLoginInMainWindow();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Bustly OAuth login
  ipcMain.handle("bustly-login", async () => {
    const loginAttemptId = bustlyLoginAttemptId + 1;
    bustlyLoginAttemptId = loginAttemptId;
    try {
      writeMainInfo("[Bustly Login] Starting Bustly OAuth login flow");
      bustlyLoginCancelled = false;

      // Initialize OAuth flow (clears any existing state)
      const oauthState = BustlyOAuth.initBustlyOAuthFlow();
      writeMainInfo("[Bustly Login] OAuth state initialized");

      // Start OAuth callback server
      const oauthPort = await startOAuthCallbackServer();
      writeMainInfo(`[Bustly Login] OAuth callback server started on port ${oauthPort}`);

      // Generate login URL
      const redirectUri = `http://127.0.0.1:${oauthPort}/authorize`;
      const loginUrl = generateLoginUrl(oauthState.loginTraceId!, redirectUri);

      // Open login URL in browser
      await shell.openExternal(loginUrl);

      // Poll for completion
      while (true) {
        await delay(2000);

        if (loginAttemptId !== bustlyLoginAttemptId) {
          writeMainInfo("[Bustly Login] Login superseded by a newer attempt");
          return { success: false, canceled: true };
        }

        if (bustlyLoginCancelled) {
          writeMainInfo("[Bustly Login] Login canceled by user");
          stopOAuthCallbackServer();
          return { success: false, canceled: true };
        }

        const code = BustlyOAuth.consumeBustlyAuthCode();

        if (code) {
          // Got the code, now exchange for token
          const apiResponse = await exchangeToken(code);
          writeMainInfo(
            `[Bustly Login] Token exchange response received user=${apiResponse.data.userEmail} workspace=${apiResponse.data.workspaceId} hasSupabaseSession=${Boolean(apiResponse.data.extras?.supabase_session?.access_token)}`,
          );

          const supabaseSession = apiResponse.data.extras?.supabase_session;
          if (!supabaseSession?.access_token) {
            throw new Error("Missing Supabase access token in API response");
          }
          if (!supabaseSession?.refresh_token) {
            throw new Error("Missing Supabase refresh token in API response");
          }

          // Read optional legacy supabase bootstrap config from API extras.
          // This is only for filling oauth supabase fields; it must not control skill enabling.
          const searchDataConfig = apiResponse.data.extras?.["bustly-search-data"];
          const filteredSkills = (apiResponse.data.skills ?? []).filter((skill) =>
            ![
              "search-data",
              "bustly-search-data",
              "bustly_search_data",
              "shopify-api",
              "shopify_api",
            ].includes(skill),
          );

          // Complete login - store user info plus Supabase session in bustlyOauth.json
          BustlyOAuth.completeBustlyLogin({
            user: {
              userId: apiResponse.data.userId,
              userName: apiResponse.data.userName,
              userEmail: apiResponse.data.userEmail,
              userAvatarUrl:
                supabaseSession.user?.user_metadata?.avatar_url?.trim()
                || supabaseSession.user?.user_metadata?.picture?.trim()
                || undefined,
              userAccessToken: supabaseSession.access_token,
              userRefreshToken: supabaseSession.refresh_token,
              sessionExpiresIn: supabaseSession.expires_in,
              sessionExpiresAt: supabaseSession.expires_at,
              sessionTokenType: supabaseSession.token_type,
              workspaceId: apiResponse.data.workspaceId,
              skills: filteredSkills,
            },
            supabase: searchDataConfig ? {
              url: searchDataConfig.search_DATA_SUPABASE_URL ?? "",
              anonKey: searchDataConfig.search_DATA_SUPABASE_ANON_KEY ?? "",
            } : undefined,
          });
          syncSentryBustlyScope();

          // Stop OAuth callback server
          stopOAuthCallbackServer();

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("bustly-login-refresh");
          }
          // Keep configured workspace header/token source aligned with latest login state.
          try {
            syncBustlyConfigFile(resolveElectronConfigPath());
          } catch (syncError) {
            writeMainWarn("[Bustly Login] Failed to sync bustly provider config:", syncError);
          }

          writeMainInfo("[Bustly Login] Login successful");
          void (async () => {
            try {
              writeMainInfo("[Bustly Login] Bootstrapping local desktop session");
              await bootstrapDesktopSession();
            } catch (bootstrapError) {
              writeMainError("[Bustly Login] Bootstrap error:", bootstrapError);
            } finally {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("bustly-login-refresh");
              }
            }
          })();

          return { success: true };
        }

      }
    } catch (error) {
      writeMainError("[Bustly Login] Error:", error);
      // Stop OAuth callback server on error
      stopOAuthCallbackServer();
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      bustlyLoginCancelled = false;
    }
  });

  ipcMain.handle("bustly-cancel-login", async () => {
    bustlyLoginCancelled = true;
    cancelOAuthFlow();
    return { success: true };
  });

  // Bustly OAuth logout
  ipcMain.handle("bustly-logout", async () => {
    try {
      writeMainInfo("[Bustly Logout] Logging out");
      BustlyOAuth.logoutBustly();
      syncSentryBustlyScope();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("bustly-login-refresh");
      }
      writeMainInfo("[Bustly Logout] Logged out successfully");

      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Logout] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-open-settings", async () => {
    try {
      const url = buildBustlyAdminUrl({ setting_modal: "profile" });
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Settings] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-report-issue", async () => {
    try {
      const archivePath = await createBustlyIssueReportArchive();
      return {
        success: true,
        archivePath,
      };
    } catch (error) {
      writeMainError("[Bustly Report Issue] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-open-workspace-settings", async (_event, workspaceId: string) => {
    try {
      const url = buildBustlyAdminUrl({
        setting_modal: "workspace-settings",
        workspace_id: workspaceId,
      });
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Workspace Settings] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-open-workspace-invite", async (_event, workspaceId: string) => {
    try {
      const url = buildBustlyAdminUrl({
        setting_modal: "members",
        workspace_id: workspaceId,
      });
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Workspace Invite] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-open-workspace-manage", async (_event, workspaceId: string) => {
    try {
      const url = buildBustlyAdminUrl({
        setting_modal: "billing",
        workspace_id: workspaceId,
      });
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Workspace Manage] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-open-workspace-pricing", async (_event, workspaceId: string) => {
    try {
      const url = buildBustlyAdminUrl({
        payment_modal: "pricing",
        workspace_id: workspaceId,
      });
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Workspace Manage] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-open-workspace-create", async (_event, workspaceId?: string) => {
    try {
      const url = buildBustlyAdminUrl({
        workspace_id: workspaceId?.trim() || undefined,
      }, "/onboarding");
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Workspace Create] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("deep-link-consume-pending", () => {
    const next = pendingDeepLink;
    pendingDeepLink = null;
    writeMainLog(
      `[DeepLink] consume pending route=${next?.route ?? "(none)"} workspaceId=${next?.workspaceId ?? "(none)"}`,
    );
    return next;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  const deepLinkArg = argv.find((value) => value.startsWith(`${APP_PROTOCOL}://`));
  if (deepLinkArg) {
    writeMainLog(`[DeepLink] second-instance argv matched ${deepLinkArg}`);
    dispatchDeepLink(deepLinkArg);
    return;
  }
  writeMainLog("[DeepLink] second-instance without protocol arg");
  focusMainWindow();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  writeMainLog(`[DeepLink] open-url ${url}`);
  dispatchDeepLink(url);
});

const initialDeepLinkArg = process.argv.find((value) => value.startsWith(`${APP_PROTOCOL}://`));

// App lifecycle
void app.whenReady().then(async () => {
  registerProtocolClient();
  if (initialDeepLinkArg) {
    dispatchDeepLink(initialDeepLinkArg);
  }
  powerSaveBlocker.start("prevent-app-suspension");
  // Load .env file at startup (must be after app is ready to get correct paths)
  const loadDotEnv = () => {
    const envPaths = [
      // Development: dist/main-dev.js -> ../.env = apps/electron/.env
      // Production: dist/main/index.js -> ../../.env = apps/electron/.env
      process.env.NODE_ENV === "development"
        ? resolve(__dirname, "../.env")
        : resolve(__dirname, "../../.env"),
    ];

    for (const envPath of envPaths) {
      try {
        if (existsSync(envPath)) {
          const envContent = readFileSync(envPath, "utf-8");
          for (const line of envContent.split("\n")) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("#")) {
              const [key, ...valueParts] = trimmedLine.split("=");
              const value = valueParts.join("=").trim();
              if (key && value) {
                process.env[key] = value;
              }
            }
          }
          writeMainInfo(
            `[Env] Loaded environment variables from ${envPath}:`,
            Object.keys(process.env).filter(
              (k) => k.startsWith("OPENCLAW_") || k.startsWith("BUSTLY_"),
            ),
          );
          break;
        }
      } catch (error) {
        writeMainError(`[Env] Failed to load ${envPath}:`, error);
      }
    }
  };
  loadDotEnv();
  setupAutoUpdater();

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (shouldOpenExternal(url)) {
        void shell.openExternal(url);
        return { action: "deny" };
      }
      return { action: "allow" };
    });
    contents.on("will-navigate", (event, url) => {
      if (shouldOpenExternal(url)) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    });
  });

  // Missing Bustly OAuth state should not wipe OpenClaw config/state.
  // Users can complete onboarding via non-Bustly auth flows, which do not
  // necessarily create bustlyOauth.json.
  const stateDir = resolveElectronStateDir();
  const bustlyOauthPath = resolve(stateDir, "bustlyOauth.json");
  if (!existsSync(bustlyOauthPath)) {
    writeMainLog(`[Init] bustlyOauth.json missing; keeping stateDir=${stateDir}`);
  } else {
    writeMainLog(`[Init] bustlyOauth.json found at ${bustlyOauthPath}`);
    try {
      syncBustlyConfigFile(resolveElectronConfigPath());
      writeMainLog("[Init] Synced openclaw.json to bustly-only provider config");
    } catch (error) {
      writeMainLog(
        `[Init] Failed to sync bustly provider config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  setupIpcHandlers();

  writeMainLog("OpenClaw Desktop starting");
  logStartupPaths();
  writeMainLog(`mainLogPath=${ensureMainLogPath()}`);
  writeMainLog(`resourcesPath=${process.resourcesPath}`);
  writeMainLog(`appVersion=${app.getVersion()} electron=${process.versions.electron}`);

  const configPath = getConfigPath();
  writeMainLog(`configPath=${configPath ?? "unresolved"}`);
  // Check if we need to initialize or re-initialize (fix broken config)
  const fullyInitialized = isFullyInitialized();
  const bustlyLoggedIn = await BustlyOAuth.isBustlyLoggedIn();
  writeMainLog(`fullyInitialized=${fullyInitialized} bustlyLoggedIn=${bustlyLoggedIn}`);
  const needsInit = !fullyInitialized;
  needsOnboardAtLaunch = needsInit && !bustlyLoggedIn;

  ensureWindow();

  if (needsInit) {
    if (bustlyLoggedIn) {
      writeMainLog("Bustly session found; bootstrapping desktop session.");
      try {
        await bootstrapDesktopSession();
        writeMainLog("Desktop session bootstrap complete");
      } catch (error) {
        writeMainError("[Init] Failed to bootstrap desktop session:", error);
      }
    } else {
      writeMainLog("Skipping auto-initialization; waiting for login.");
    }
  } else {
    writeMainLog("Configuration already exists and is valid");
    if (bustlyLoggedIn) {
      const workspaceId = resolveBustlyWorkspaceIdFromOAuthState();
      if (workspaceId && await hasMissingBustlyWorkspaceSetup(workspaceId)) {
        try {
          await synchronizeBustlyWorkspaceContext();
          writeMainLog("Synchronized Bustly workspace context for missing main session or preset agents");
        } catch (error) {
          writeMainLog(
            `Bustly workspace sync failed while restoring main session or preset agents: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        writeMainLog("Skipped Bustly workspace sync; main session and preset agents already exist");
      }
    }
    // Load existing config to get port and token
    const existingConfig = loadGatewayConfig();
    if (existingConfig) {
      gatewayPort = existingConfig.port;
      gatewayBind = existingConfig.bind;
      if (existingConfig.token) {
        gatewayToken = existingConfig.token;
      }
    }
  }

  if (!needsInit) {
    // Auto-start gateway
    writeMainLog("Gateway auto-starting");
    try {
      await startGateway();
      writeMainLog("Gateway started successfully");
    } catch (error) {
      writeMainError("[Gateway] ✗ Failed to start gateway:", error);
    }
  }
});

app.on("window-all-closed", async () => {
  writeMainInfo("[Lifecycle] All windows closed");

  // On non-macOS platforms, quit the app when all windows are closed
  if (process.platform !== "darwin") {
    writeMainInfo("[Lifecycle] Quitting app (non-macOS)");
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    writeMainInfo("[Lifecycle] Reactivating app (create new window)");
    ensureWindow();
  }
});

app.on("before-quit", async () => {
  writeMainLog("App about to quit");

  if (updateInstalling) {
    writeMainLog("[Updater] Update install in progress; skipping graceful gateway shutdown");
    return;
  }

  // Ensure gateway is stopped before quitting
  if (gatewayProcess) {
    writeMainInfo("[Gateway] Force stopping gateway before quit...");
    try {
      await stopGateway();
    } catch (error) {
      writeMainError("[Gateway] ✗ Failed to stop gateway:", error);
    }
  }

  // Stop OAuth callback server
  writeMainInfo("[Bustly] Stopping OAuth callback server");
  stopOAuthCallbackServer();
});

process.on("uncaughtException", (error) => {
  writeMainError("[Main] uncaughtException:", error);
});

process.on("unhandledRejection", (reason) => {
  writeMainError("[Main] unhandledRejection:", reason);
});
