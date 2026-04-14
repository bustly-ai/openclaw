import { app, session, type ProxyConfig } from "electron";
import { writeMainError, writeMainInfo, writeMainWarn } from "./logger.js";

const DEFAULT_MAIN_HTTP_TIMEOUT_MS = 30_000;

export type MainHttpProxyMode = NonNullable<ProxyConfig["mode"]>;

export type MainHttpProxySettings = {
  mode: MainHttpProxyMode;
  summary: string;
};

export type MainHttpFetchOptions = RequestInit & {
  label?: string;
  timeoutMs?: number;
};

let configuredProxySettings: MainHttpProxySettings | null = null;
let proxyInitPromise: Promise<MainHttpProxySettings> | null = null;

function toProxyConfig(settings: MainHttpProxySettings): ProxyConfig {
  return { mode: settings.mode };
}

function buildProxySettings(): MainHttpProxySettings {
  return {
    mode: "system" as const,
    summary: "system",
  };
}

function formatErrorWithCause(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  if (!cause) {
    return error.message;
  }
  const causeMessage = cause instanceof Error ? cause.message : String(cause);
  return `${error.message} cause=${causeMessage}`;
}

function mergeSignals(primary?: AbortSignal | null, timeoutMs?: number): AbortSignal | undefined {
  const signals: AbortSignal[] = [];
  if (primary) {
    signals.push(primary);
  }
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    signals.push(AbortSignal.timeout(timeoutMs));
  }
  if (signals.length === 0) {
    return undefined;
  }
  if (signals.length === 1) {
    return signals[0];
  }
  return AbortSignal.any(signals);
}

function resolveRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function resolveRequestMethod(input: string | URL | Request, method?: string): string {
  if (method?.trim()) {
    return method.trim().toUpperCase();
  }
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function isSameProxySettings(next: MainHttpProxySettings, current: MainHttpProxySettings | null): boolean {
  return JSON.stringify(next) === JSON.stringify(current);
}

async function applyProxySettings(): Promise<MainHttpProxySettings> {
  if (!app.isReady()) {
    throw new Error("Main HTTP client cannot initialize before app is ready.");
  }

  const nextSettings = buildProxySettings();
  if (isSameProxySettings(nextSettings, configuredProxySettings)) {
    return nextSettings;
  }

  const electronProxyConfig = toProxyConfig(nextSettings);
  await session.defaultSession.setProxy(electronProxyConfig);
  await session.defaultSession.closeAllConnections();
  configuredProxySettings = nextSettings;
  writeMainInfo(`[HTTP] Main HTTP proxy configured ${nextSettings.summary}`);
  return nextSettings;
}

async function ensureProxySettings(): Promise<MainHttpProxySettings> {
  if (configuredProxySettings) {
    return configuredProxySettings;
  }
  return await initializeMainHttpClient();
}

export function resolveMainHttpProxySettings(): MainHttpProxySettings {
  return buildProxySettings();
}

export async function initializeMainHttpClient(): Promise<MainHttpProxySettings> {
  if (proxyInitPromise) {
    return await proxyInitPromise;
  }

  proxyInitPromise = applyProxySettings()
    .catch((error) => {
      writeMainError("[HTTP] Failed to configure main HTTP proxy:", error);
      throw error;
    })
    .finally(() => {
      proxyInitPromise = null;
    });

  return await proxyInitPromise;
}

export async function resolveMainHttpProxyRoute(url: string): Promise<string> {
  const settings = await ensureProxySettings();
  try {
    return await session.defaultSession.resolveProxy(url);
  } catch (error) {
    writeMainWarn(
      `[HTTP] Failed to resolve proxy route url=${url} configured=${settings.summary} error=${formatErrorWithCause(error)}`,
    );
    return settings.summary;
  }
}

export async function mainHttpFetch(
  input: string | URL | Request,
  options: MainHttpFetchOptions = {},
): Promise<Response> {
  const { label, timeoutMs = DEFAULT_MAIN_HTTP_TIMEOUT_MS, signal, ...init } = options;
  const url = resolveRequestUrl(input);
  const method = resolveRequestMethod(input, init.method);

  await ensureProxySettings();
  const proxyRoute = await resolveMainHttpProxyRoute(url);

  try {
    return await session.defaultSession.fetch(url, {
      ...init,
      signal: mergeSignals(signal, timeoutMs),
    });
  } catch (error) {
    writeMainWarn(
      `[HTTP] Request failed label=${label ?? "(none)"} method=${method} url=${url} proxy=${proxyRoute} timeoutMs=${timeoutMs} error=${formatErrorWithCause(error)}`,
    );
    throw error;
  }
}

export function resetMainHttpClientForTests(): void {
  configuredProxySettings = null;
  proxyInitPromise = null;
}
