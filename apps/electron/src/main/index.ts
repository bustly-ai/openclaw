import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  shell,
  powerSaveBlocker,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
} from "electron";
import * as Sentry from "@sentry/electron/main";
import { randomUUID } from "node:crypto";
import { resolve, dirname, basename, join, delimiter as pathDelimiter } from "node:path";
import { fork, spawn, spawnSync, ChildProcess } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  statSync,
  rmSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Socket, createServer } from "node:net";
import updater from "electron-updater";
import { WebSocket } from "ws";
import {
  ensureGatewayRuntimeCliShim,
  type GatewayRuntimeCliShim,
} from "../../../../src/gateway/runtime-cli-shim.js";
import { buildGatewayRuntimeEnv } from "../../../../src/gateway/runtime-env.js";
import {
  initializeOpenClaw,
  getConfigPath,
  isFullyInitialized,
  type InitializationResult,
} from "./auto-init.js";
import {
  resolveOpenClawCliPath,
  resolveElectronRunAsNodeExecPath,
} from "./cli-utils.js";
import {
  exchangeToken,
  generateLoginUrl,
  startOAuthCallbackServer,
  stopOAuthCallbackServer,
} from "./oauth-handler.js";
import * as BustlyOAuth from "./bustly-oauth.js";
import { buildBustlyAdminUrl as buildSharedBustlyAdminUrl } from "../../../../src/bustly/admin-links.js";
import {
  resolveBustlyWorkspaceAgentWorkspaceDir as resolveSharedBustlyWorkspaceAgentWorkspaceDir,
  resolveBustlyWorkspaceIdFromOAuthState as resolveSharedBustlyWorkspaceIdFromOAuthState,
  synchronizeBustlyWorkspaceContext,
} from "../../../../src/bustly/workspace-runtime.js";
import {
  ELECTRON_OPENCLAW_PROFILE,
  resolveElectronBackendLogPath,
  resolveElectronIsolatedConfigPath,
  resolveElectronIsolatedStateDir,
} from "./defaults.js";
import {
  DEFAULT_BUSTLY_AGENT_NAME,
} from "../shared/bustly-agent.js";
import { initializeMainHttpClient } from "./http-client.js";
import {
  ensureMainLogPath,
  setMainLogSink,
  writeMainError,
  writeMainInfo,
  writeMainLog,
  writeMainWarn,
} from "./logger.js";
type DesktopUpdateStage =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "launching-helper"
  | "downloading"
  | "preparing"
  | "downloaded"
  | "installing"
  | "restarted"
  | "error";

type DesktopUpdateState = {
  sessionId: string | null;
  stage: DesktopUpdateStage;
  currentVersion: string;
  targetVersion: string | null;
  ready: boolean;
  helperActive: boolean;
  progressPercent: number | null;
  transferred: number | null;
  total: number | null;
  bytesPerSecond: number | null;
  message: string | null;
  error: string | null;
  updatedAt: number;
};

type UpdateFileInfo = {
  url?: string;
  info?: {
    url?: string;
  };
};

type UpdateInfoSnapshot = {
  version?: string | null;
  path?: string | null;
  files?: UpdateFileInfo[];
};

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

function loadMainProcessEnvFromDotEnv(): void {
  const isDevelopment = process.env.NODE_ENV === "development";
  const envPathCandidates = isDevelopment
    ? [
        resolve(__dirname, "../../.env.internal"),
        resolve(__dirname, "../.env.internal"),
        resolve(process.cwd(), ".env.internal"),
        resolve(__dirname, "../../.env"),
        resolve(__dirname, "../.env"),
        resolve(process.cwd(), ".env"),
      ]
    : [
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

loadMainProcessEnvFromDotEnv();

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV || "production",
});
syncSentryBustlyScope();

if (process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL?.trim()) {
  process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL =
    process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL.trim();
  writeMainInfo("[Bustly Prompts] Loaded template base URL from env:", {
    nodeEnv: process.env.NODE_ENV || "production",
    url: process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL,
  });
}

const autoUpdater = updater.autoUpdater;
const APP_DISPLAY_NAME = "Bustly";
const APP_PROTOCOL = "bustly";
const DEEP_LINK_CHANNEL = "deep-link";
const UPDATE_HELPER_ARG = "--updater-helper";
const UPDATE_STATE_FILE_ARG_PREFIX = "--update-state-file=";
const UPDATE_STATE_STALE_MS = 15 * 60 * 1000;
const supportsDetachedUpdaterHelper = false;

app.setName(APP_DISPLAY_NAME);

const isUpdaterHelperMode = process.argv.includes(UPDATE_HELPER_ARG);
const updaterHelperStateArg = process.argv.find((value) => value.startsWith(UPDATE_STATE_FILE_ARG_PREFIX));
const updaterHelperStateFilePath = updaterHelperStateArg
  ? updaterHelperStateArg.slice(UPDATE_STATE_FILE_ARG_PREFIX.length)
  : null;

if (isUpdaterHelperMode) {
  try {
    app.setPath("userData", join(app.getPath("temp"), "bustly-updater-helper"));
  } catch {}
}

let gatewayProcess: ChildProcess | null = null;
let gatewayStartPromise: Promise<boolean> | null = null;
let mainWindow: BrowserWindow | null = null;
let isAppQuitting = false;
let quitConfirmationInFlight = false;
let needsOnboardAtLaunch = false;
let gatewayPort: number = 17999;
let gatewayBind: string = "loopback";
let gatewayToken: string | null = null;
let gatewayStartupInFlight = false;
let gatewayShutdownExpected = false;
let gatewayAutoRestartAttempt = 0;
let gatewayAutoRestartTimer: NodeJS.Timeout | null = null;
let gatewayLastWorkerFailure: {
  kind: "config" | "runtime";
  message: string;
} | null = null;
type BustlyLoginAttemptState =
  | "pending"
  | "exchanging"
  | "initializing"
  | "completed"
  | "error"
  | "canceled";
type BustlyLoginAttempt = {
  loginTraceId: string;
  loginUrl: string;
  status: BustlyLoginAttemptState;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};
const bustlyLoginAttempts = new Map<string, BustlyLoginAttempt>();
let activeBustlyLoginTraceId: string | null = null;
let latestAvailableVersion: string | null = null;
let latestUpdateInfo: UpdateInfoSnapshot | null = null;
let updateStateFilePath: string | null = updaterHelperStateFilePath;
let updaterHelperLaunchPromise: Promise<void> | null = null;
let updaterHelperPollTimer: NodeJS.Timeout | null = null;
let updateState: DesktopUpdateState = {
  sessionId: null,
  stage: "idle",
  currentVersion: app.getVersion(),
  targetVersion: null,
  ready: false,
  helperActive: false,
  progressPercent: null,
  transferred: null,
  total: null,
  bytesPerSecond: null,
  message: null,
  error: null,
  updatedAt: Date.now(),
};

setMainLogSink((entry) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("main-log", entry);
  }
});

function emitGatewayLifecycle(
  phase: "starting" | "stopping" | "ready" | "error",
  message?: string,
  opts?: { canRestoreLastGoodConfig?: boolean },
): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("gateway-lifecycle", {
    phase,
    message: message ?? null,
    canRestoreLastGoodConfig: opts?.canRestoreLastGoodConfig === true,
  });
}

const IMAGE_PREVIEW_EXT_RE = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|tiff|webp)$/i;
const CHAT_MEDIA_PREVIEW_EXT_RE = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|tiff|webp|mp4|mov|webm|mkv|m4v|mp3|wav|ogg|m4a|aac|flac|opus)$/i;
const CHAT_MEDIA_PREVIEW_MAX_BYTES = 25 * 1024 * 1024;

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

function resolveChatMediaPreviewMimeType(filePath: string): string | null {
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
  if (lower.endsWith(".mp4")) {return "video/mp4";}
  if (lower.endsWith(".mov")) {return "video/quicktime";}
  if (lower.endsWith(".webm")) {return "video/webm";}
  if (lower.endsWith(".mkv")) {return "video/x-matroska";}
  if (lower.endsWith(".m4v")) {return "video/x-m4v";}
  if (lower.endsWith(".mp3")) {return "audio/mpeg";}
  if (lower.endsWith(".wav")) {return "audio/wav";}
  if (lower.endsWith(".ogg")) {return "audio/ogg";}
  if (lower.endsWith(".m4a")) {return "audio/mp4";}
  if (lower.endsWith(".aac")) {return "audio/aac";}
  if (lower.endsWith(".flac")) {return "audio/flac";}
  if (lower.endsWith(".opus")) {return "audio/ogg";}
  return null;
}

function resolveChatMediaPreview(filePath: string): {
  dataUrl: string;
  mimeType: string;
  kind: "image" | "video" | "audio";
} | null {
  if (!CHAT_MEDIA_PREVIEW_EXT_RE.test(filePath)) {
    return null;
  }
  const mimeType = resolveChatMediaPreviewMimeType(filePath);
  if (!mimeType) {
    return null;
  }
  const kind = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
        ? "audio"
        : null;
  if (!kind) {
    return null;
  }
  const stats = statSync(filePath);
  if (!Number.isFinite(stats.size) || stats.size <= 0 || stats.size > CHAT_MEDIA_PREVIEW_MAX_BYTES) {
    return null;
  }
  const base64 = readFileSync(filePath).toString("base64");
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
    kind,
  };
}
let updateReady = false;
let updateVersion: string | null = null;
let updateInstalling = false;
let nativeInstallPrepared = false;
let nativeInstallPreparationPromise: Promise<void> | null = null;

function shouldBypassQuitConfirmationForUpdateInstall(): boolean {
  return updateInstalling || updateState.stage === "installing";
}

type NativeAutoUpdaterBridge = {
  checkForUpdates: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
};

type MacUpdaterBridge = {
  nativeUpdater?: NativeAutoUpdaterBridge;
  squirrelDownloadedUpdate?: boolean;
};
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

function buildBustlyAdminUrl(params: Record<string, string | null | undefined>, path?:string): string {
  return buildSharedBustlyAdminUrl({
    query: params,
    path,
  });
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

function applyInitializationResult(result: InitializationResult): void {
  initResult = result;
  gatewayPort = result.gatewayPort;
  gatewayBind = result.gatewayBind;
  gatewayToken = result.gatewayToken ?? null;
  needsOnboardAtLaunch = false;
}

// Gateway configuration
const GATEWAY_HOST = "127.0.0.1";
const GATEWAY_PROTOCOL_VERSION = 3;
const GATEWAY_TASKS_STATUS_TIMEOUT_MS = 2_000;
const BUSTLY_LOGIN_HASH = "/bustly-login";
const BUSTLY_RENDERER_URL = process.env.BUSTLY_RENDERER_URL?.trim() || "";
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

function resolveElectronStateDir(): string {
  return resolveElectronIsolatedStateDir();
}

function resolveElectronConfigPath(): string {
  return resolveElectronIsolatedConfigPath();
}

function resolveGatewayLastGoodConfigPath(): string {
  return join(resolveElectronStateDir(), "electron", "gateway", "openclaw.last-good.json");
}

function hasGatewayLastGoodConfigSnapshot(): boolean {
  return existsSync(resolveGatewayLastGoodConfigPath());
}

function snapshotGatewayLastGoodConfig(): void {
  const configPath = resolveElectronConfigPath();
  if (!existsSync(configPath)) {
    return;
  }
  const snapshotPath = resolveGatewayLastGoodConfigPath();
  mkdirSync(dirname(snapshotPath), { recursive: true, mode: 0o700 });
  copyFileSync(configPath, snapshotPath);
  writeMainLog(`[Gateway] Saved last-good config snapshot to ${snapshotPath}`);
}

function restoreGatewayLastGoodConfigSnapshot(): void {
  const snapshotPath = resolveGatewayLastGoodConfigPath();
  if (!existsSync(snapshotPath)) {
    throw new Error("No last working gateway config is available");
  }
  const configPath = resolveElectronConfigPath();
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  copyFileSync(snapshotPath, configPath);
  writeMainLog(`[Gateway] Restored last-good config snapshot from ${snapshotPath}`);
}

function clearGatewayAutoRestartTimer(): void {
  if (gatewayAutoRestartTimer) {
    clearTimeout(gatewayAutoRestartTimer);
    gatewayAutoRestartTimer = null;
  }
}

function isLikelyGatewayConfigError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid config") ||
    normalized.includes("legacy config") ||
    normalized.includes("requires gateway.") ||
    normalized.includes("requires gateway ") ||
    normalized.includes("gateway.bind=") ||
    normalized.includes("refusing to bind gateway") ||
    normalized.includes("tailscale") ||
    normalized.includes("allowedorigins") ||
    normalized.includes("trusted-proxy")
  );
}

function scheduleGatewayAutoRestart(reason: string): void {
  if (gatewayAutoRestartTimer || gatewayShutdownExpected || gatewayStartupInFlight || gatewayProcess) {
    return;
  }
  const attempt = gatewayAutoRestartAttempt + 1;
  const delayMs = Math.min(1_000 * 2 ** (attempt - 1), 10_000);
  gatewayAutoRestartAttempt = attempt;
  writeMainWarn(`[Gateway] Unexpected exit. Restart attempt ${attempt} in ${delayMs}ms: ${reason}`);
  emitGatewayLifecycle("starting", `Gateway interrupted. Recovering${attempt > 1 ? ` (attempt ${attempt})` : ""}...`);
  gatewayAutoRestartTimer = setTimeout(() => {
    gatewayAutoRestartTimer = null;
    void startGateway().catch((error) => {
      writeMainError("[Gateway] Auto-restart failed:", error);
    });
  }, delayMs);
}

function resolveBustlyWorkspaceAgentWorkspaceDir(
  workspaceId: string,
  agentName: string = DEFAULT_BUSTLY_AGENT_NAME,
): string {
  return resolveSharedBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName, process.env);
}

function resolveBustlyWorkspaceIdFromOAuthState(): string {
  return resolveSharedBustlyWorkspaceIdFromOAuthState();
}

async function initializeGatewayRuntimeForBustlyWorkspace(params: {
  workspaceId: string;
  workspaceName?: string;
}): Promise<void> {
  const workspaceId = params.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("Missing Bustly workspaceId for gateway runtime initialization.");
  }

  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId);
  writeMainInfo(
    `[Init] Ensuring gateway runtime for Bustly workspace ${workspaceId} at ${workspaceDir}`,
  );
  const result = await initializeOpenClaw({
    workspace: workspaceDir,
  });
  if (!result.success) {
    throw new Error(result.error ?? "Failed to initialize OpenClaw");
  }

  await synchronizeBustlyWorkspaceContext({
    workspaceId,
    workspaceName: params.workspaceName,
    allowCreateConfig: true,
    userAgent: "openclaw-desktop",
    env: process.env,
  });

  applyInitializationResult({
    ...result,
    workspace: workspaceDir,
  });
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
  const envPaths =
    process.env.NODE_ENV === "development"
      ? [
          resolve(__dirname, "../.env.internal"),
          resolve(__dirname, "../.env"),
          resolve(app.getAppPath(), ".env.internal"),
          resolve(app.getAppPath(), ".env"),
        ]
      : [resolve(__dirname, "../../.env"), resolve(app.getAppPath(), ".env")];

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
}): {
  env: NodeJS.ProcessEnv;
  cliShim: GatewayRuntimeCliShim | null;
} {
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
    ? ensureGatewayRuntimeCliShim({
      cliPath: params.cliPath,
      stateDir,
      runtimeCommand: resolveElectronRunAsNodeExecPath(),
      runtimeEnv: {
        ELECTRON_RUN_AS_NODE: "1",
      },
      resourcesPath,
      appPath,
    })
    : null;
  const bunInstall = process.env.BUN_INSTALL?.trim() || resolve(homeDir, ".bun");
  const homebrewPrefix = process.env.HOMEBREW_PREFIX?.trim() || "/opt/homebrew";
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
  const runtimeEnv = buildGatewayRuntimeEnv({
    env: {
      ...process.env,
      ...loadElectronEnvVars(),
      ...loginShellEnv,
      PATH: fixedPath,
    },
    resourcesPath,
    appPath,
    bundledPluginsDir,
    stateDir,
    configPath: resolveElectronConfigPath(),
    profile: ELECTRON_OPENCLAW_PROFILE,
    logFile: resolveElectronBackendLogPath(),
    bundledVersion: bundledVersion ?? undefined,
    preferBundledPlugins: true,
    oauthCallbackPort: params?.oauthCallbackPort,
    pathPrepend: [bundledCliShim?.shimDir],
    execPathPrepend: [bundledCliShim?.shimDir],
  });

  return {
    cliShim: bundledCliShim,
    env: {
      ...runtimeEnv,
      NODE_ENV: "production",
      HOME: homeDir,
      USERPROFILE: homeDir,
      OPENCLAW_LOAD_SHELL_ENV: "1",
      SHELL: shellPath,
      BUN_INSTALL: bunInstall,
      HOMEBREW_PREFIX: homebrewPrefix,
      TERM: process.env.TERM?.trim() || "xterm-256color",
      COLORTERM: process.env.COLORTERM?.trim() || "truecolor",
      TERM_PROGRAM: process.env.TERM_PROGRAM?.trim() || "OpenClaw",
      NODE_PATH: effectiveNodePath,
    },
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
    mainWindow.webContents.send(UPDATE_STATUS_CHANNEL, { event, state: updateState, ...payload });
  }
}

function getUpdateStateFilePath() {
  if (!updateStateFilePath) {
    updateStateFilePath = join(app.getPath("userData"), "updater-state.json");
  }
  return updateStateFilePath;
}

function readPersistedUpdateState(filePath = getUpdateStateFilePath()): DesktopUpdateState | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Partial<DesktopUpdateState>;
    return {
      sessionId: typeof raw.sessionId === "string" ? raw.sessionId : null,
      stage: typeof raw.stage === "string" ? raw.stage : "idle",
      currentVersion: typeof raw.currentVersion === "string" ? raw.currentVersion : app.getVersion(),
      targetVersion: typeof raw.targetVersion === "string" ? raw.targetVersion : null,
      ready: raw.ready === true,
      helperActive: raw.helperActive === true,
      progressPercent: typeof raw.progressPercent === "number" ? raw.progressPercent : null,
      transferred: typeof raw.transferred === "number" ? raw.transferred : null,
      total: typeof raw.total === "number" ? raw.total : null,
      bytesPerSecond: typeof raw.bytesPerSecond === "number" ? raw.bytesPerSecond : null,
      message: typeof raw.message === "string" ? raw.message : null,
      error: typeof raw.error === "string" ? raw.error : null,
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    };
  } catch (error) {
    writeMainLog(`[Updater] Failed to read update state: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function persistUpdateState() {
  if (isUpdaterHelperMode) {
    return;
  }
  const filePath = getUpdateStateFilePath();
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(updateState, null, 2));
  } catch (error) {
    writeMainLog(`[Updater] Failed to persist update state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function clearPersistedUpdateState() {
  if (isUpdaterHelperMode) {
    return;
  }
  const filePath = getUpdateStateFilePath();
  try {
    rmSync(filePath, { force: true });
  } catch {}
}

function publishUpdateState(event: DesktopUpdateStage, next: Partial<DesktopUpdateState> = {}) {
  updateState = {
    ...updateState,
    ...next,
    stage: event,
    currentVersion: next.currentVersion ?? app.getVersion(),
    updatedAt: Date.now(),
  };
  persistUpdateState();
  sendUpdateStatus(event);
}

function buildUpdaterHelperArgs(filePath: string) {
  const args: string[] = [];
  if (process.defaultApp && process.argv[1]) {
    args.push(resolve(process.argv[1]));
  }
  args.push(UPDATE_HELPER_ARG, `${UPDATE_STATE_FILE_ARG_PREFIX}${filePath}`);
  return args;
}

function hasMacZipArtifact(info: UpdateInfoSnapshot | null) {
  if (!info) {
    return false;
  }
  const pathValue = typeof info.path === "string" ? info.path.toLowerCase() : "";
  if (pathValue.endsWith(".zip")) {
    return true;
  }
  return (info.files ?? []).some((file) => {
    const url = typeof file.url === "string" ? file.url.toLowerCase() : "";
    const nestedUrl = typeof file.info?.url === "string" ? file.info.url.toLowerCase() : "";
    return url.endsWith(".zip") || nestedUrl.endsWith(".zip");
  });
}

function resolveShipItStatePath() {
  if (process.platform !== "darwin") {
    return null;
  }
  const bundleId = app.getName().trim().toLowerCase();
  if (!bundleId) {
    return null;
  }
  return join(app.getPath("home"), "Library", "Caches", `${bundleId}.ShipIt`, "ShipItState.plist");
}

function logShipItStateStatus(phase: string) {
  const path = resolveShipItStatePath();
  if (!path) {
    writeMainLog(`[Updater] ${phase} ShipItState: unsupported platform or bundle id`);
    return;
  }
  writeMainLog(`[Updater] ${phase} ShipItState: ${path} exists=${existsSync(path)}`);
}

async function waitForShipItState(timeoutMs = 2_500) {
  const filePath = resolveShipItStatePath();
  if (!filePath) {
    return true;
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(filePath)) {
      return true;
    }
    await delay(120);
  }
  return false;
}

function formatUpdateFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ZIP file not provided")) {
    return "This macOS update is missing the required ZIP package. Publish the ZIP in the update feed before installing.";
  }
  return message;
}

function getMacUpdaterBridge(): MacUpdaterBridge | null {
  if (process.platform !== "darwin") {
    return null;
  }
  return autoUpdater as typeof autoUpdater & MacUpdaterBridge;
}

function markUpdatePrepared(targetVersion: string | null) {
  nativeInstallPrepared = true;
  updateReady = true;
  updateVersion = targetVersion;
  publishUpdateState("downloaded", {
    targetVersion,
    ready: true,
    helperActive: false,
    progressPercent: 100,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    message: targetVersion
      ? `${targetVersion} is ready. Restart to install.`
      : "The update is ready. Restart to install.",
    error: null,
  });
}

async function prepareMacUpdateInstall(targetVersion: string | null) {
  if (process.platform !== "darwin") {
    markUpdatePrepared(targetVersion);
    return;
  }
  if (nativeInstallPrepared) {
    markUpdatePrepared(targetVersion);
    return;
  }
  if (nativeInstallPreparationPromise) {
    return nativeInstallPreparationPromise;
  }
  const bridge = getMacUpdaterBridge();
  const nativeUpdater = bridge?.nativeUpdater;
  if (!bridge || !nativeUpdater) {
    throw new Error("The macOS updater bridge is unavailable.");
  }
  if (bridge.squirrelDownloadedUpdate === true) {
    markUpdatePrepared(targetVersion);
    return;
  }
  publishUpdateState("preparing", {
    targetVersion,
    ready: false,
    helperActive: false,
    progressPercent: 100,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    message: targetVersion
      ? `Preparing ${targetVersion} for restart...`
      : "Preparing the update for restart...",
    error: null,
  });
  nativeInstallPreparationPromise = new Promise<void>((resolve, reject) => {
    const onDownloaded = () => {
      cleanup();
      writeMainLog("[Updater] Native macOS updater prepared the install");
      markUpdatePrepared(targetVersion);
      resolve();
    };
    const onError = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const cleanup = () => {
      nativeUpdater.removeListener("update-downloaded", onDownloaded);
      nativeUpdater.removeListener("error", onError);
    };
    nativeUpdater.on("update-downloaded", onDownloaded);
    nativeUpdater.on("error", onError);
    writeMainLog("[Updater] Triggering native macOS updater preparation");
    nativeUpdater.checkForUpdates();
  }).finally(() => {
    nativeInstallPreparationPromise = null;
  });
  return nativeInstallPreparationPromise;
}

async function launchUpdaterHelper() {
  if (isUpdaterHelperMode || !supportsDetachedUpdaterHelper) {
    return;
  }
  if (updaterHelperLaunchPromise) {
    return updaterHelperLaunchPromise;
  }
  const filePath = getUpdateStateFilePath();
  const args = buildUpdaterHelperArgs(filePath);
  updaterHelperLaunchPromise = (async () => {
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, BUSTLY_UPDATER_HELPER: "1" },
    });
    child.unref();
    await delay(600);
  })().finally(() => {
    updaterHelperLaunchPromise = null;
  });
  return updaterHelperLaunchPromise;
}

function startUpdaterHelperPolling() {
  if (!isUpdaterHelperMode || updaterHelperPollTimer || !updaterHelperStateFilePath) {
    return;
  }
  let lastSerialized = "";
  const tick = () => {
    const nextState = readPersistedUpdateState(updaterHelperStateFilePath);
    if (!nextState) {
      return;
    }
    const serialized = JSON.stringify(nextState);
    if (serialized === lastSerialized) {
      return;
    }
    lastSerialized = serialized;
    updateState = nextState;
    sendUpdateStatus(nextState.stage);
    if (nextState.stage === "restarted") {
      setTimeout(() => {
        app.quit();
      }, 1_200);
    }
  };
  tick();
  updaterHelperPollTimer = setInterval(tick, 400);
}

function stopUpdaterHelperPolling() {
  if (!updaterHelperPollTimer) {
    return;
  }
  clearInterval(updaterHelperPollTimer);
  updaterHelperPollTimer = null;
}

function isMacShipItInstallLikelyActive() {
  if (process.platform !== "darwin") {
    return false;
  }
  try {
    const result = spawnSync("/usr/bin/pgrep", ["-fal", "bustly.ShipIt"], {
      encoding: "utf-8",
    });
    const output = (result.stdout ?? "").trim().toLowerCase();
    return output.length > 0;
  } catch {
    return false;
  }
}

async function handlePendingInstallOnLaunch() {
  const persistedState = readPersistedUpdateState();
  if (!persistedState) {
    return false;
  }
  updateState = persistedState;
  latestAvailableVersion = persistedState.targetVersion;

  if (Date.now() - persistedState.updatedAt > UPDATE_STATE_STALE_MS) {
    clearPersistedUpdateState();
    updateState = {
      ...updateState,
      sessionId: null,
      stage: "idle",
      targetVersion: null,
      ready: false,
      helperActive: false,
      progressPercent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      message: null,
      error: null,
      updatedAt: Date.now(),
    };
    return false;
  }

  if (persistedState.stage === "installing" && persistedState.targetVersion && persistedState.targetVersion !== app.getVersion()) {
    const installAgeMs = Date.now() - persistedState.updatedAt;
    const installLikelyActive = installAgeMs < 90_000 || isMacShipItInstallLikelyActive();
    if (!installLikelyActive) {
      writeMainLog("[Updater] Clearing stale installing state on launch");
      clearPersistedUpdateState();
      updateState = {
        ...updateState,
        sessionId: null,
        stage: "idle",
        targetVersion: null,
        ready: false,
        helperActive: false,
        progressPercent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        message: null,
        error: null,
        updatedAt: Date.now(),
      };
      return false;
    }
    writeMainLog("[Updater] Install appears active; quitting silently to avoid blocking ShipIt");
    updateInstalling = true;
    isAppQuitting = true;
    app.quit();
    return true;
  }

  if (persistedState.stage === "installing" && persistedState.targetVersion === app.getVersion()) {
    publishUpdateState("restarted", {
      currentVersion: app.getVersion(),
      targetVersion: app.getVersion(),
      helperActive: false,
      ready: false,
      progressPercent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      message: `Updated to ${app.getVersion()}. Opening Bustly...`,
      error: null,
    });
    setTimeout(() => {
      clearPersistedUpdateState();
    }, 1_500);
  }

  return false;
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
  if (gatewayStartPromise) {
    return gatewayStartPromise;
  }
  gatewayStartPromise = (async (): Promise<boolean> => {
  const oauthCallbackPort = await startOAuthCallbackServer();
  writeMainInfo(`[Bustly] OAuth callback server started on port ${oauthCallbackPort}`);

  const startAt = Date.now();
  if (gatewayProcess) {
    writeMainLog("Gateway already running");
    emitGatewayLifecycle("ready");
    return true;
  }

  clearGatewayAutoRestartTimer();
  gatewayShutdownExpected = false;
  gatewayStartupInFlight = true;
  gatewayLastWorkerFailure = null;
  emitGatewayLifecycle("starting", "Starting bustly...");

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

  return await new Promise<boolean>((resolvePromise, reject) => {
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
    const nodePath = resolveElectronRunAsNodeExecPath();
    writeMainLog(
      `Gateway runtime: execPath=${nodePath} mode=electron-run-as-node helper=${nodePath !== process.execPath ? "yes" : "no"}`,
    );

    const { env: spawnEnv, cliShim: bundledCliShim } = buildElectronCliEnv({
      cliPath,
      oauthCallbackPort,
    });
    spawnEnv.ELECTRON_RUN_AS_NODE = "1";
    spawnEnv.OPENCLAW_GATEWAY_PORT = String(gatewayPort);
    spawnEnv.OPENCLAW_ELECTRON_GATEWAY_BIND = gatewayBind;
    if (process.env.NODE_ENV === "development") {
      spawnEnv.OPENCLAW_ELECTRON_DEV = "1";
    } else {
      delete spawnEnv.OPENCLAW_ELECTRON_DEV;
    }
    if (gatewayToken) {
      spawnEnv.OPENCLAW_GATEWAY_TOKEN = gatewayToken;
    } else {
      delete spawnEnv.OPENCLAW_GATEWAY_TOKEN;
    }
    writeMainLog(
      `Gateway env: SHELL=${shellPath} OPENCLAW_LOAD_SHELL_ENV=1 NODE_PATH=${effectiveNodePath || "(empty)"} PATH_HEAD=${spawnEnv.PATH?.split(pathDelimiter)[0] ?? fixedPath.split(pathDelimiter)[0] ?? "(empty)"} cliShim=${bundledCliShim?.openclawShimPath ?? "(none)"} appPath=${appPath} resourcesPath=${resourcesPath} candidates=${nodePathStatus || "(none)"} rawOpenClawNodeModules=${openclawNodeModules} rawResourcesNodeModules=${resourcesNodeModules} rawAppNodeModules=${appNodeModules} inheritedNodePath=${inheritedNodePath ?? "(none)"} worker=${gatewayWorkerPath}`,
    );

    writeMainLog(
      `Gateway fork: execPath=${nodePath} module=${gatewayWorkerPath} port=${gatewayPort} bind=${gatewayBind}`,
    );
    gatewayProcess = fork(gatewayWorkerPath, [], {
      env: spawnEnv,
      execPath: nodePath,
      silent: true,
    });

    gatewayProcess.on("message", (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return;
      }
      const message = payload as { type?: unknown; kind?: unknown; message?: unknown };
      if (
        message.type === "gateway-worker-startup-error" &&
        (message.kind === "config" || message.kind === "runtime") &&
        typeof message.message === "string"
      ) {
        gatewayLastWorkerFailure = {
          kind: message.kind,
          message: message.message,
        };
        writeMainWarn(`[Gateway worker startup error] ${message.kind}: ${message.message}`);
        return;
      }
      if (
        message.type === "gateway-worker-fatal" &&
        message.kind === "runtime" &&
        typeof message.message === "string"
      ) {
        gatewayLastWorkerFailure = {
          kind: "runtime",
          message: message.message,
        };
        writeMainError(`[Gateway worker fatal] ${message.message}`);
      }
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
        writeMainError(`Gateway stderr: ${output}`);
      }
      mainWindow?.webContents.send("gateway-log", { stream: "stderr", message: output });
    });

    gatewayProcess.on("error", (error) => {
      writeMainError("[Gateway error]:", error);
      gatewayStartupInFlight = false;
      gatewayProcess = null;
      reject(error);
    });

    gatewayProcess.on("exit", (code, signal) => {
      const exitReason = `code=${code ?? "null"} signal=${signal ?? "null"}`;
      writeMainLog(
        `Gateway exited: ${exitReason}`,
      );
      if (recentStderr.length > 0) {
        writeMainLog(`Gateway stderr tail:\n${recentStderr.join("\n")}`);
      } else if (recentStdout.length > 0) {
        writeMainLog(`Gateway stdout tail:\n${recentStdout.join("\n")}`);
      }
      const startupFailure = gatewayStartupInFlight;
      gatewayStartupInFlight = false;
      gatewayProcess = null;
      mainWindow?.webContents.send("gateway-exit", { code, signal });
      if (!startupFailure && !gatewayShutdownExpected) {
        const failureMessage = gatewayLastWorkerFailure?.message || `Gateway exited unexpectedly (${exitReason})`;
        if (gatewayLastWorkerFailure?.kind === "config" || isLikelyGatewayConfigError(failureMessage)) {
          emitGatewayLifecycle("error", failureMessage, {
            canRestoreLastGoodConfig: hasGatewayLastGoodConfigSnapshot(),
          });
          return;
        }
        scheduleGatewayAutoRestart(failureMessage);
      }
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
        gatewayStartupInFlight = false;
        gatewayAutoRestartAttempt = 0;
        gatewayLastWorkerFailure = null;
        snapshotGatewayLastGoodConfig();
        emitGatewayLifecycle("ready");
        resolvePromise(true);
      })
      .catch((error) => {
        const elapsedMs = Date.now() - startAt;
        writeMainLog(`Gateway startup failed after ${elapsedMs}ms`);
        gatewayStartupInFlight = false;
        const stderrTail = recentStderr.length > 0 ? recentStderr.join("\n") : "";
        const stdoutTail = recentStdout.length > 0 ? recentStdout.join("\n") : "";
        if (stderrTail) {
          writeMainLog(`Gateway startup stderr:\n${stderrTail}`);
        } else if (stdoutTail) {
          writeMainLog(`Gateway startup stdout:\n${stdoutTail}`);
        }
        const lifecycleMessage =
          gatewayLastWorkerFailure?.message ||
          (error instanceof Error ? error.message : String(error));
        const configFailure =
          gatewayLastWorkerFailure?.kind === "config" ||
          isLikelyGatewayConfigError([lifecycleMessage, stderrTail, stdoutTail].filter(Boolean).join("\n"));
        if (gatewayProcess && !gatewayProcess.killed) {
          gatewayShutdownExpected = true;
          gatewayProcess.kill("SIGTERM");
        }
        emitGatewayLifecycle(
          "error",
          lifecycleMessage,
          { canRestoreLastGoodConfig: configFailure && hasGatewayLastGoodConfigSnapshot() },
        );
        reject(error);
      });
  });
  })();
  const startupPromise = gatewayStartPromise;
  if (!startupPromise) {
    return false;
  }
  return await startupPromise.finally(() => {
    gatewayStartPromise = null;
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

    clearGatewayAutoRestartTimer();
    gatewayShutdownExpected = true;
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

type BustlyTasksStatus = {
  hasRunningTasks: boolean;
  runningCount: number;
};

function normalizeGatewayTasksStatus(payload: unknown): BustlyTasksStatus {
  if (!payload || typeof payload !== "object") {
    return { hasRunningTasks: false, runningCount: 0 };
  }
  const rec = payload as {
    hasRunningTasks?: unknown;
    runningCount?: unknown;
  };
  const runningCount =
    typeof rec.runningCount === "number" && Number.isFinite(rec.runningCount)
      ? Math.max(0, Math.floor(rec.runningCount))
      : 0;
  const hasRunningTasks =
    typeof rec.hasRunningTasks === "boolean" ? rec.hasRunningTasks : runningCount > 0;
  return {
    hasRunningTasks,
    runningCount,
  };
}

async function fetchGatewayBustlyTasksStatus(): Promise<BustlyTasksStatus> {
  if (!gatewayProcess || gatewayProcess.killed) {
    return { hasRunningTasks: false, runningCount: 0 };
  }

  const token = readGatewayTokenFromConfig() ?? gatewayToken;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const gatewayUrl = `ws://${GATEWAY_HOST}:${gatewayPort}${query}`;

  return await new Promise<BustlyTasksStatus>((resolve, reject) => {
    let settled = false;
    const connectRequestId = randomUUID();
    const statusRequestId = randomUUID();
    let connectSent = false;
    let statusSent = false;

    const ws = new WebSocket(gatewayUrl, {
      handshakeTimeout: GATEWAY_TASKS_STATUS_TIMEOUT_MS,
    });

    const finishSuccess = (next: BustlyTasksStatus) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
      resolve(next);
    };

    const finishError = (message: string, error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
      const resolvedError =
        error instanceof Error ? error : new Error(error ? `${message}: ${String(error)}` : message);
      writeMainLog(`[Lifecycle] ${message}${error ? `: ${resolvedError.message}` : ""}`);
      reject(resolvedError);
    };

    const timeout = setTimeout(() => {
      finishError("Gateway tasks status check timed out");
    }, GATEWAY_TASKS_STATUS_TIMEOUT_MS);

    ws.once("error", (error) => {
      finishError("Gateway tasks status check failed", error);
    });

    ws.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") {
        return;
      }
      const frame = parsed as {
        type?: unknown;
        event?: unknown;
        payload?: unknown;
        id?: unknown;
        ok?: unknown;
      };
      if (frame.type === "event" && frame.event === "connect.challenge" && !connectSent) {
        connectSent = true;
        const connectFrame = {
          type: "req",
          id: connectRequestId,
          method: "connect",
          params: {
            minProtocol: GATEWAY_PROTOCOL_VERSION,
            maxProtocol: GATEWAY_PROTOCOL_VERSION,
            client: {
              id: "gateway-client",
              version: app.getVersion(),
              platform: process.platform,
              mode: "backend",
            },
            role: "operator",
            scopes: ["operator.read"],
            auth: token
              ? {
                  token,
                  password: token,
                }
              : undefined,
          },
        };
        ws.send(JSON.stringify(connectFrame));
        return;
      }
      if (frame.type !== "res" || typeof frame.id !== "string") {
        return;
      }
      if (frame.id === connectRequestId) {
        if (frame.ok !== true || statusSent) {
          finishError("Gateway tasks status connect failed");
          return;
        }
        statusSent = true;
        const statusFrame = {
          type: "req",
          id: statusRequestId,
          method: "bustly.tasks.status",
          params: {},
        };
        ws.send(JSON.stringify(statusFrame));
        return;
      }
      if (frame.id === statusRequestId) {
        if (frame.ok !== true) {
          finishError("Gateway tasks status request failed");
          return;
        }
        finishSuccess(normalizeGatewayTasksStatus((parsed as { payload?: unknown }).payload));
      }
    });

    ws.once("close", () => {
      if (!settled) {
        finishError("Gateway tasks status socket closed before response");
      }
    });
  });
}

function normalizeRendererHash(hash?: string): string | null {
  const trimmed = hash?.trim();
  if (!trimmed) {
    return null;
  }
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!withoutHash) {
    return null;
  }
  return withoutHash.startsWith("/") ? withoutHash : `/${withoutHash}`;
}

const REMOTE_RENDERER_FALLBACK_HASH = "/cdn-load-error";
const LOCAL_RENDERER_ONLY_HASHES = new Set(["/update-helper"]);
let lastRequestedRendererHash: string | undefined;

function loadRendererFallbackWindow(targetWindow: BrowserWindow, options?: { hash?: string }) {
  if (process.env.NODE_ENV === "development") {
    const normalizedHash = normalizeRendererHash(options?.hash);
    const url = normalizedHash ? `http://localhost:5180/#${normalizedHash}` : "http://localhost:5180";
    targetWindow.loadURL(url).catch((error) => {
      writeMainLog(`Renderer fallback load failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    return;
  }

  const filePath = resolve(__dirname, "../renderer/index.html");
  const loadOptions = options?.hash ? { hash: options.hash } : undefined;
  targetWindow.loadFile(filePath, loadOptions).catch((error) => {
    writeMainLog(`Renderer fallback load failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

function resolveRemoteRendererUrl(hash?: string): string | null {
  if (!BUSTLY_RENDERER_URL) {
    return null;
  }
  try {
    const url = new URL(BUSTLY_RENDERER_URL);
    const normalizedHash = normalizeRendererHash(hash);
    if (normalizedHash) {
      url.hash = normalizedHash;
    }
    return url.toString();
  } catch (error) {
    writeMainLog(
      `[Renderer] Invalid BUSTLY_RENDERER_URL "${BUSTLY_RENDERER_URL}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function loadRendererWindow(targetWindow: BrowserWindow, options?: { hash?: string }) {
  lastRequestedRendererHash = options?.hash;
  const normalizedHash = normalizeRendererHash(options?.hash);
  if (normalizedHash && LOCAL_RENDERER_ONLY_HASHES.has(normalizedHash)) {
    loadRendererFallbackWindow(targetWindow, { hash: normalizedHash });
    return;
  }

  const remoteRendererUrl = resolveRemoteRendererUrl(options?.hash);
  if (remoteRendererUrl) {
    let didFallback = false;
    targetWindow.webContents.once("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || validatedURL !== remoteRendererUrl || errorCode === -3 || didFallback) {
        return;
      }
      didFallback = true;
      writeMainError(
        `[Renderer] Remote renderer failed to load (${errorCode}): ${errorDescription || "unknown error"}`,
      );
      loadRendererFallbackWindow(targetWindow, { hash: REMOTE_RENDERER_FALLBACK_HASH });
    });
    targetWindow.loadURL(remoteRendererUrl).catch((error) => {
      writeMainLog(`Renderer load failed: ${error instanceof Error ? error.message : String(error)}`);
      if (!didFallback) {
        didFallback = true;
        loadRendererFallbackWindow(targetWindow, { hash: REMOTE_RENDERER_FALLBACK_HASH });
      }
    });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    const url = options?.hash ? `http://localhost:5180/#${options.hash}` : "http://localhost:5180";
    targetWindow.loadURL(url).catch((error) => {
      writeMainLog(`Renderer load failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  } else {
    loadRendererFallbackWindow(targetWindow, { hash: options?.hash ?? REMOTE_RENDERER_FALLBACK_HASH });
  }
}

function attachNativeContextMenu(targetWindow: BrowserWindow): void {
  targetWindow.webContents.on("context-menu", (_event, params) => {
    const hasSelection = Boolean(params.selectionText?.trim());
    const template: MenuItemConstructorOptions[] = [];
    const pushSeparator = () => {
      if (template.length > 0 && template[template.length - 1]?.type !== "separator") {
        template.push({ type: "separator" });
      }
    };

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        template.push({
          label: suggestion,
          click: () => {
            targetWindow.webContents.replaceMisspelling(suggestion);
          },
        });
      }
      if (params.dictionarySuggestions.length > 0) {
        pushSeparator();
      }
      template.push({
        label: "Add to Dictionary",
        click: () => {
          targetWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
        },
      });
    }

    if (params.isEditable) {
      pushSeparator();
      template.push(
        { role: "undo", enabled: params.editFlags.canUndo },
        { role: "redo", enabled: params.editFlags.canRedo },
      );
      pushSeparator();
      template.push(
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
      );
      if (process.platform === "darwin") {
        template.push({ role: "pasteAndMatchStyle", enabled: params.editFlags.canPaste });
      }
      template.push({ role: "delete", enabled: params.editFlags.canDelete });
      pushSeparator();
      template.push({ role: "selectAll", enabled: params.editFlags.canSelectAll });
    } else if (hasSelection) {
      pushSeparator();
      template.push(
        { role: "copy", enabled: true },
        { role: "selectAll", enabled: params.editFlags.canSelectAll },
      );
    }

    if (template.length === 0) {
      return;
    }
    if (template[template.length - 1]?.type === "separator") {
      template.pop();
    }

    Menu.buildFromTemplate(template).popup({ window: targetWindow });
  });
}

function createUpdaterHelperWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 168,
    minWidth: 420,
    minHeight: 168,
    maxWidth: 420,
    maxHeight: 168,
    useContentSize: true,
    backgroundColor: "#FBF8F2",
    titleBarStyle: "hiddenInset",
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
    },
    title: "Bustly Updater",
  });

  attachNativeContextMenu(mainWindow);
  loadRendererWindow(mainWindow, { hash: "/update-helper" });
  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
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

  attachNativeContextMenu(mainWindow);

  // Load the app
  if (process.env.NODE_ENV === "development") {
    loadRendererWindow(mainWindow);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    loadRendererWindow(mainWindow);
  }

  mainWindow.on("close", (event) => {
    if (isAppQuitting) {
      return;
    }
    event.preventDefault();
    writeMainInfo("[Lifecycle] Hiding main window instead of closing");
    mainWindow?.hide();
  });

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

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
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
    publishUpdateState("checking", {
      message: "Checking for updates...",
      error: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    writeMainLog(`[Updater] Update available: ${info.version}`);
    nativeInstallPrepared = false;
    nativeInstallPreparationPromise = null;
    updateReady = false;
    updateVersion = null;
    latestAvailableVersion = info.version ?? null;
    latestUpdateInfo = info as UpdateInfoSnapshot;
    publishUpdateState("available", {
      targetVersion: info.version ?? null,
      ready: false,
      helperActive: false,
      progressPercent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      message: info.version ? `Version ${info.version} is ready to install.` : "A new update is ready to install.",
      error: null,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    writeMainLog(`[Updater] No updates available (current: ${info.version})`);
    if (
      updateState.stage === "preparing" ||
      updateState.stage === "downloading" ||
      updateState.stage === "downloaded" ||
      updateState.stage === "installing"
    ) {
      return;
    }
    latestAvailableVersion = null;
    latestUpdateInfo = null;
    nativeInstallPrepared = false;
    nativeInstallPreparationPromise = null;
    updateReady = false;
    updateVersion = null;
    publishUpdateState("not-available", {
      targetVersion: null,
      ready: false,
      helperActive: false,
      progressPercent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      message: "Bustly is up to date.",
      error: null,
    });
  });

  autoUpdater.on("error", (error) => {
    const message = formatUpdateFailure(error);
    writeMainLog(`[Updater] Error: ${message}`);
    nativeInstallPreparationPromise = null;
    nativeInstallPrepared = false;
    publishUpdateState("error", {
      ready: false,
      message: "Update failed.",
      error: message,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState("downloading", {
      ready: false,
      progressPercent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
      message: latestAvailableVersion
        ? `Downloading ${latestAvailableVersion}...`
        : "Downloading update...",
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    writeMainLog(`[Updater] Update downloaded: ${info.version}`);
    logShipItStateStatus("after-download");
    latestAvailableVersion = info.version ?? null;
    updateReady = false;
    updateVersion = null;
    publishUpdateState("preparing", {
      targetVersion: info.version ?? null,
      ready: false,
      helperActive: false,
      progressPercent: 100,
      message: info.version ? `Downloaded ${info.version}. Preparing restart...` : "Downloaded update. Preparing restart...",
      error: null,
    });
    void prepareMacUpdateInstall(info.version ?? null).catch((error: unknown) => {
      const message = formatUpdateFailure(error);
      writeMainLog(`[Updater] Failed to prepare macOS install: ${message}`);
      publishUpdateState("error", {
        ready: false,
        helperActive: false,
        message: "Update failed.",
        error: message,
      });
    });
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
      latestUpdateInfo = (result?.updateInfo ?? null) as UpdateInfoSnapshot | null;
      if (downloadPromise && typeof downloadPromise.catch === "function") {
        void downloadPromise.catch((error: unknown) => {
          const message = formatUpdateFailure(error);
          writeMainLog(`[Updater] background download failed: ${message}`);
          publishUpdateState("error", {
            ready: false,
            message: "Update failed.",
            error: message,
          });
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return;
  }
  if (app.isReady()) {
    createWindow();
    return;
  }
  app.once("ready", () => createWindow());
}

function setBustlyLoginAttempt(
  loginTraceId: string,
  updates: Partial<BustlyLoginAttempt>,
): BustlyLoginAttempt {
  const current = bustlyLoginAttempts.get(loginTraceId);
  const next: BustlyLoginAttempt = {
    loginTraceId,
    loginUrl: updates.loginUrl ?? current?.loginUrl ?? "",
    status: updates.status ?? current?.status ?? "pending",
    error: updates.error ?? current?.error ?? null,
    startedAt: updates.startedAt ?? current?.startedAt ?? Date.now(),
    finishedAt:
      updates.finishedAt === undefined ? current?.finishedAt ?? null : updates.finishedAt,
  };
  bustlyLoginAttempts.set(loginTraceId, next);
  return next;
}

function finishBustlyLoginAttempt(
  loginTraceId: string,
  params: {
    status: Exclude<BustlyLoginAttemptState, "pending" | "exchanging" | "initializing">;
    error?: string | null;
  },
): BustlyLoginAttempt {
  if (activeBustlyLoginTraceId === loginTraceId) {
    activeBustlyLoginTraceId = null;
  }
  return setBustlyLoginAttempt(loginTraceId, {
    status: params.status,
    error: params.error ?? null,
    finishedAt: Date.now(),
  });
}

function resolveBustlyFilteredSkills(skills: string[] | undefined): string[] {
  return (skills ?? []).filter((skill) =>
    ![
      "search-data",
      "bustly-search-data",
      "bustly_search_data",
      "shopify-api",
      "shopify_api",
    ].includes(skill),
  );
}

function resolveBustlyUserAvatarUrl(apiResponse: Awaited<ReturnType<typeof exchangeToken>>): string | undefined {
  return (
    apiResponse.data.extras?.supabase_session?.user?.user_metadata?.avatar_url?.trim()
    || apiResponse.data.extras?.supabase_session?.user?.user_metadata?.picture?.trim()
    || undefined
  );
}

async function waitForBustlyDesktopAuthCode(
  loginTraceId: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const attempt = bustlyLoginAttempts.get(loginTraceId);
    if (!attempt) {
      throw new Error("Login session not found");
    }
    if (attempt.status === "canceled") {
      throw new Error("Login canceled");
    }
    if (attempt.status === "error") {
      throw new Error(attempt.error || "Login failed");
    }
    const currentState = BustlyOAuth.readBustlyOAuthState();
    if (currentState?.loginTraceId !== loginTraceId) {
      throw new Error("Login state was replaced");
    }
    const authCode = BustlyOAuth.consumeBustlyAuthCode();
    if (authCode) {
      return authCode;
    }
    await delay(250);
  }
  throw new Error("Login timed out");
}

async function runElectronBustlyLogin(loginTraceId: string): Promise<void> {
  try {
    const authCode = await waitForBustlyDesktopAuthCode(loginTraceId);
    setBustlyLoginAttempt(loginTraceId, {
      status: "exchanging",
      error: null,
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Callback reached the local OAuth server; switch renderer to loading
      // immediately instead of waiting for token exchange/runtime init.
      mainWindow.webContents.send("bustly-login-progress");
    }
    const apiResponse = await exchangeToken(authCode);
    const supabaseSession = apiResponse.data.extras?.supabase_session;
    const supabaseAccessToken = supabaseSession?.access_token?.trim() ?? "";
    if (!supabaseAccessToken) {
      throw new Error("Missing Supabase access token in API response");
    }
    const searchDataConfig = apiResponse.data.extras?.["bustly-search-data"];
    BustlyOAuth.completeBustlyLogin({
      user: {
        userId: apiResponse.data.userId,
        userName: apiResponse.data.userName,
        userEmail: apiResponse.data.userEmail,
        userAvatarUrl: resolveBustlyUserAvatarUrl(apiResponse),
        userAccessToken: supabaseAccessToken,
        userRefreshToken: supabaseSession?.refresh_token,
        sessionExpiresIn: supabaseSession?.expires_in,
        sessionExpiresAt: supabaseSession?.expires_at,
        sessionTokenType: supabaseSession?.token_type,
        workspaceId: apiResponse.data.workspaceId,
        skills: resolveBustlyFilteredSkills(apiResponse.data.skills),
      },
      supabase: searchDataConfig
        ? {
            url: searchDataConfig.search_DATA_SUPABASE_URL ?? "",
            anonKey: searchDataConfig.search_DATA_SUPABASE_ANON_KEY ?? "",
          }
        : undefined,
    });
    setBustlyLoginAttempt(loginTraceId, {
      status: "initializing",
      error: null,
    });
    await initializeGatewayRuntimeForBustlyWorkspace({
      workspaceId: apiResponse.data.workspaceId,
    });
    syncSentryBustlyScope();
    finishBustlyLoginAttempt(loginTraceId, { status: "completed" });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("bustly-login-refresh");
    }
    writeMainInfo(`[Bustly OAuth] Electron login completed trace=${loginTraceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Login canceled" ? "canceled" : "error";
    finishBustlyLoginAttempt(loginTraceId, { status, error: message });
    if (status === "error") {
      writeMainError("[Bustly OAuth] Electron login failed:", error);
    } else {
      writeMainInfo(`[Bustly OAuth] Electron login canceled trace=${loginTraceId}`);
    }
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
        applyInitializationResult(result);
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

  ipcMain.handle("bustly-login", async () => {
    try {
      const activeAttempt = activeBustlyLoginTraceId
        ? bustlyLoginAttempts.get(activeBustlyLoginTraceId)
        : null;
      if (activeAttempt?.status === "pending" && activeAttempt.loginUrl) {
        await shell.openExternal(activeAttempt.loginUrl);
        return {
          success: true,
          loginTraceId: activeAttempt.loginTraceId,
        };
      }

      const oauthCallbackPort = await startOAuthCallbackServer();
      const oauthState = BustlyOAuth.initBustlyOAuthFlow(oauthCallbackPort);
      const loginTraceId = oauthState.loginTraceId?.trim() ?? "";
      if (!loginTraceId) {
        throw new Error("Missing login trace ID");
      }
      const redirectUri = `http://127.0.0.1:${oauthCallbackPort}/authorize`;
      const loginUrl = generateLoginUrl(loginTraceId, redirectUri);
      if (activeBustlyLoginTraceId && activeBustlyLoginTraceId !== loginTraceId) {
        finishBustlyLoginAttempt(activeBustlyLoginTraceId, {
          status: "canceled",
          error: "Superseded by a newer login attempt",
        });
      }
      activeBustlyLoginTraceId = loginTraceId;
      setBustlyLoginAttempt(loginTraceId, {
        loginUrl,
        status: "pending",
        error: null,
        startedAt: Date.now(),
        finishedAt: null,
      });
      void runElectronBustlyLogin(loginTraceId);
      try {
        await shell.openExternal(loginUrl);
      } catch (error) {
        finishBustlyLoginAttempt(loginTraceId, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        BustlyOAuth.clearBustlyOAuthState();
        throw error;
      }
      return {
        success: true,
        loginTraceId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-poll-login", async (_event, loginTraceId?: string) => {
    const traceId = typeof loginTraceId === "string" ? loginTraceId.trim() : "";
    if (!traceId) {
      return { success: false, pending: false, error: "Missing loginTraceId" };
    }
    const attempt = bustlyLoginAttempts.get(traceId);
    if (!attempt) {
      const loggedIn = await BustlyOAuth.isBustlyLoggedIn();
      if (loggedIn) {
        return { success: true, pending: false };
      }
      return { success: false, pending: false, error: "Login session not found" };
    }
    if (attempt.status === "pending" || attempt.status === "exchanging" || attempt.status === "initializing") {
      return { success: true, pending: true };
    }
    if (attempt.status === "completed") {
      return { success: true, pending: false };
    }
    return {
      success: false,
      pending: false,
      error: attempt.error || (attempt.status === "canceled" ? "Login canceled" : "Login failed"),
    };
  });

  ipcMain.handle("bustly-cancel-login", async (_event, loginTraceId?: string) => {
    const traceId = typeof loginTraceId === "string" ? loginTraceId.trim() : "";
    const targetTraceId = traceId || activeBustlyLoginTraceId || "";
    if (!targetTraceId) {
      return { success: true };
    }
    const attempt = bustlyLoginAttempts.get(targetTraceId);
    if (attempt?.status && attempt.status !== "pending") {
      return { success: true };
    }
    if (await BustlyOAuth.isBustlyLoggedIn()) {
      if (attempt?.status === "pending") {
        finishBustlyLoginAttempt(targetTraceId, { status: "completed" });
      }
      return { success: true };
    }
    finishBustlyLoginAttempt(targetTraceId, {
      status: "canceled",
      error: "Login canceled",
    });
    BustlyOAuth.clearBustlyOAuthState();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("bustly-login-refresh");
    }
    return { success: true };
  });

  ipcMain.handle("bustly-is-logged-in", async () => {
    try {
      return {
        success: true,
        loggedIn: await BustlyOAuth.isBustlyLoggedIn(),
      };
    } catch (error) {
      return {
        success: false,
        loggedIn: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-get-user-info", async () => {
    try {
      return {
        success: true,
        user: await BustlyOAuth.getBustlyUserInfo(),
      };
    } catch (error) {
      return {
        success: false,
        user: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("bustly-logout", () => {
    try {
      BustlyOAuth.logoutBustly();
      syncSentryBustlyScope();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("bustly-login-refresh");
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Start gateway
  ipcMain.handle("gateway-start", async () => {
    try {
      if (!isFullyInitialized()) {
        return { success: false, error: "OpenClaw is not onboarded yet." };
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

  ipcMain.handle("gateway-restore-last-good-config", async () => {
    try {
      clearGatewayAutoRestartTimer();
      if (gatewayProcess) {
        await stopGateway();
      }
      restoreGatewayLastGoodConfigSnapshot();
      gatewayLastWorkerFailure = null;
      gatewayAutoRestartAttempt = 0;
      emitGatewayLifecycle("starting", "Restoring last working gateway config...");
      await startGateway();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitGatewayLifecycle("error", message, {
        canRestoreLastGoodConfig: hasGatewayLastGoodConfigSnapshot(),
      });
      return { success: false, error: message };
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
          const preview = resolveChatMediaPreview(selectedPath);
          if (preview?.kind === "image") {
            imageUrl = preview.dataUrl;
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
    try {
      const preview = resolveChatMediaPreview(targetPath);
      if (!preview || preview.kind !== "image") {
        return null;
      }
      return preview.dataUrl;
    } catch {
      return null;
    }
  });

  ipcMain.handle("resolve-chat-media-preview", async (_event, rawPath: string) => {
    const targetPath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!targetPath) {
      return null;
    }
    try {
      return resolveChatMediaPreview(targetPath);
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

  ipcMain.handle("open-external-url", async (_event, rawUrl: string) => {
    const targetUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!targetUrl) {
      return { success: false, error: "Expected a non-empty URL." };
    }
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { success: false, error: "Expected an http(s) URL." };
      }
      await shell.openExternal(parsed.toString());
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
    const environment = process.env.NODE_ENV || "production";
    return {
      version: app.getVersion(),
      name: app.getName(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      environment,
      isDevelopment: environment === "development",
    };
  });

  ipcMain.handle("window-native-fullscreen-status", () => {
    return { isNativeFullscreen: Boolean(mainWindow?.isFullScreen()) };
  });
  ipcMain.handle("renderer-reload-remote", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window is not available" };
    }
    if (!BUSTLY_RENDERER_URL) {
      return { success: false, error: "BUSTLY_RENDERER_URL is not configured" };
    }
    loadRendererWindow(mainWindow, { hash: lastRequestedRendererHash });
    return { success: true };
  });

  ipcMain.handle("updater-check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      latestUpdateInfo = (result?.updateInfo ?? null) as UpdateInfoSnapshot | null;
      const downloadPromise = result?.downloadPromise;
      if (downloadPromise && typeof downloadPromise.catch === "function") {
        void downloadPromise.catch((error: unknown) => {
          const message = formatUpdateFailure(error);
          writeMainLog(`[Updater] manual download failed: ${message}`);
          sendUpdateStatus("error", { error: message });
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("updater-start-install", async () => {
    if (isUpdaterHelperMode) {
      return { success: false, error: "Updater helper cannot start a new update." };
    }
    try {
      if (
        updateState.stage === "launching-helper" ||
        updateState.stage === "downloading" ||
        updateState.stage === "preparing" ||
        updateState.stage === "downloaded" ||
        updateState.stage === "installing"
      ) {
        return { success: true };
      }

      let targetVersion = latestAvailableVersion ?? updateState.targetVersion;
      if (!targetVersion) {
        const result = await autoUpdater.checkForUpdates();
        targetVersion = result?.updateInfo?.version ?? null;
        latestUpdateInfo = (result?.updateInfo ?? null) as UpdateInfoSnapshot | null;
      }

      if (!targetVersion || targetVersion === app.getVersion()) {
        return { success: false, error: "No update is available." };
      }

      if (process.platform === "darwin" && !hasMacZipArtifact(latestUpdateInfo)) {
        return {
          success: false,
          error: "This macOS release is missing the ZIP package required by electron-updater.",
        };
      }

      updateReady = false;
      updateVersion = null;
      nativeInstallPrepared = false;
      nativeInstallPreparationPromise = null;
      latestAvailableVersion = targetVersion;
      publishUpdateState("downloading", {
        sessionId: randomUUID(),
        targetVersion,
        ready: false,
        helperActive: false,
        progressPercent: supportsDetachedUpdaterHelper ? null : 0,
        transferred: supportsDetachedUpdaterHelper ? null : 0,
        total: null,
        bytesPerSecond: null,
        message: `Downloading ${targetVersion}...`,
        error: null,
      });
      publishUpdateState("downloading", {
        targetVersion,
        helperActive: false,
        progressPercent: 0,
        transferred: 0,
        total: null,
        bytesPerSecond: null,
        message: `Downloading ${targetVersion}...`,
        error: null,
      });
      void Promise.resolve(autoUpdater.downloadUpdate()).catch((error: unknown) => {
        const message = formatUpdateFailure(error);
        writeMainLog(`[Updater] manual download failed: ${message}`);
        publishUpdateState("error", {
          ready: false,
          helperActive: false,
          message: "Update failed.",
          error: message,
        });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("updater-install", async () => {
    try {
      if (!nativeInstallPrepared || !updateReady) {
        return { success: false, error: "The update is still being prepared. Wait until restart is available." };
      }
      writeMainLog("[Updater] updater-install requested");
      logShipItStateStatus("before-install");
      if (latestUpdateInfo?.path) {
        writeMainLog(`[Updater] updateInfo.path=${latestUpdateInfo.path}`);
      }
      if (supportsDetachedUpdaterHelper) {
        try {
          await launchUpdaterHelper();
          writeMainLog("[Updater] Detached helper launched");
        } catch (error) {
          writeMainLog(`[Updater] Detached helper launch failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      publishUpdateState("installing", {
        targetVersion: updateVersion,
        helperActive: supportsDetachedUpdaterHelper,
        ready: true,
        progressPercent: 100,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        message: "Restarting to install the update.",
        error: null,
      });
      updateInstalling = true;
      const shipItReady = await waitForShipItState();
      if (!shipItReady) {
        const statePath = resolveShipItStatePath() ?? "(unresolved)";
        const message = `ShipItState.plist not found at ${statePath}. The updater request is missing; please retry the update.`;
        writeMainLog(`[Updater] ${message}`);
        logShipItStateStatus("install-failed");
        publishUpdateState("error", {
          ready: false,
          helperActive: false,
          message: "Update failed.",
          error: message,
        });
        updateInstalling = false;
        return { success: false, error: message };
      }
      setTimeout(() => {
        writeMainLog("[Updater] Calling quitAndInstall");
        autoUpdater.quitAndInstall(false, true);
      }, 1_200);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("updater-status", () => {
    return {
      ready: updateReady,
      version: updateVersion,
      state: updateState,
    };
  });

  // === Onboarding handlers ===

  // === Bustly OAuth handlers ===

  // Open Bustly login page (standalone)
  ipcMain.handle("bustly-open-login", () => {
    try {
      openBustlyLoginInMainWindow();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
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

  ipcMain.handle("bustly-open-workspace-integrations", async (_event, workspaceId: string) => {
    try {
      const url = buildBustlyAdminUrl({
        setting_modal: "integration",
        workspace_id: workspaceId,
      });
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      writeMainError("[Bustly Workspace Integrations] Error:", error);
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

if (!isUpdaterHelperMode) {
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
}

const initialDeepLinkArg = process.argv.find((value) => value.startsWith(`${APP_PROTOCOL}://`));

// App lifecycle
void app.whenReady().then(async () => {
  if (isUpdaterHelperMode) {
    createUpdaterHelperWindow();
    startUpdaterHelperPolling();
    return;
  }
  registerProtocolClient();
  if (initialDeepLinkArg) {
    dispatchDeepLink(initialDeepLinkArg);
  }
  powerSaveBlocker.start("prevent-app-suspension");
  // Load env file at startup (must be after app is ready to get correct paths)
  const loadDotEnv = () => {
    const isDevelopment = process.env.NODE_ENV === "development";
    const envPaths = isDevelopment
      ? [
          // Development: prefer test/internal endpoints when available.
          resolve(__dirname, "../../.env.internal"),
          resolve(__dirname, "../.env.internal"),
          resolve(process.cwd(), ".env.internal"),
          resolve(__dirname, "../../.env"),
          resolve(__dirname, "../.env"),
          resolve(process.cwd(), ".env"),
        ]
      : [
          resolve(__dirname, "../../.env"),
          resolve(__dirname, "../.env"),
          resolve(process.cwd(), ".env"),
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
  try {
    await initializeMainHttpClient();
  } catch (error) {
    writeMainError("[HTTP] Main HTTP client initialization failed:", error);
  }
  if (await handlePendingInstallOnLaunch()) {
    return;
  }
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
  let shouldAutoStartGateway = !needsInit;

  ensureWindow();

  if (needsInit) {
    if (bustlyLoggedIn) {
      writeMainLog("Bustly session found; initializing gateway runtime before starting gateway.");
      try {
        const workspaceId = resolveBustlyWorkspaceIdFromOAuthState();
        if (!workspaceId) {
          throw new Error("Missing Bustly workspaceId in OAuth state");
        }
        await initializeGatewayRuntimeForBustlyWorkspace({ workspaceId });
        shouldAutoStartGateway = true;
        writeMainLog("Gateway runtime initialization complete");
      } catch (error) {
        writeMainError("[Init] Failed to initialize gateway runtime for Bustly session:", error);
      }
    } else {
      writeMainLog("Skipping auto-initialization; waiting for login.");
    }
  } else {
    writeMainLog("Configuration already exists and is valid");
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

  if (shouldAutoStartGateway) {
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

  if (isUpdaterHelperMode) {
    app.quit();
    return;
  }

  // On non-macOS platforms, quit the app when all windows are closed
  if (process.platform !== "darwin") {
    writeMainInfo("[Lifecycle] Quitting app (non-macOS)");
    app.quit();
  }
});

app.on("activate", () => {
  if (isUpdaterHelperMode) {
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    writeMainInfo("[Lifecycle] Reactivating app (show existing window)");
    focusMainWindow();
    return;
  }
  if (BrowserWindow.getAllWindows().length === 0) {
    writeMainInfo("[Lifecycle] Reactivating app (create new window)");
    ensureWindow();
  }
});

app.on("before-quit", async (event) => {
  writeMainLog("App about to quit");

  if (isUpdaterHelperMode) {
    isAppQuitting = true;
    stopUpdaterHelperPolling();
    return;
  }

  if (shouldBypassQuitConfirmationForUpdateInstall()) {
    isAppQuitting = true;
    writeMainLog("[Updater] Update install in progress; skipping graceful gateway shutdown");
    return;
  }

  if (!isAppQuitting) {
    if (quitConfirmationInFlight) {
      event.preventDefault();
      return;
    }
    quitConfirmationInFlight = true;
    event.preventDefault();

    let shouldConfirmQuit = false;
    try {
      const tasksStatus = await fetchGatewayBustlyTasksStatus();
      shouldConfirmQuit = tasksStatus.hasRunningTasks;
    } catch (error) {
      writeMainError("[Lifecycle] Failed to confirm quit with gateway tasks status:", error);
      // Fail closed: if status check is unavailable, require confirmation to avoid dropping active tasks silently.
      shouldConfirmQuit = true;
    }

    if (shouldConfirmQuit) {
      const result = await dialog.showMessageBox(mainWindow ?? undefined, {
        type: "none",
        buttons: ["Cancel", "Quit"],
        defaultId: 1,
        cancelId: 0,
        title: "Quit Bustly?",
        message: "Are you sure you want to quit Bustly?",
        detail: "All running tasks will be interrupted. Scheduled tasks will not be triggered.",
        noLink: true,
      });
      if (result.response !== 1) {
        quitConfirmationInFlight = false;
        return;
      }
    }

    quitConfirmationInFlight = false;
    isAppQuitting = true;
    app.quit();
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
