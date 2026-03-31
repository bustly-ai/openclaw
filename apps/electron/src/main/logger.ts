import * as Sentry from "@sentry/electron/main";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inspect } from "node:util";
import { resolveElectronIsolatedStateDir } from "./defaults.js";

export type MainLogLevel = "info" | "warn" | "error";

type MainLogSink = (entry: { level: MainLogLevel; message: string }) => void;

let mainLogPath: string | null = null;
let mainLogSink: MainLogSink | null = null;
let sentryLogReportingActive = false;

function formatLogArg(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  return inspect(value, { depth: 6, breakLength: 120, maxArrayLength: 50 });
}

function mapLevelToSentry(level: MainLogLevel): "info" | "warning" | "error" {
  if (level === "warn") {
    return "warning";
  }
  return level;
}

function addSentryBreadcrumb(level: "info" | "warning", message: string, category: string): void {
  if (sentryLogReportingActive) {
    return;
  }
  sentryLogReportingActive = true;
  try {
    Sentry.addBreadcrumb({
      type: "default",
      category,
      level,
      message,
      data: {
        logger: category,
        log_message: message,
      },
    });
  } catch {
    // Never let Sentry reporting break the main process.
  } finally {
    sentryLogReportingActive = false;
  }
}

function captureSentryError(message: string, error?: unknown): void {
  if (sentryLogReportingActive) {
    return;
  }
  sentryLogReportingActive = true;
  try {
    if (error instanceof Error) {
      Sentry.withScope((scope) => {
        scope.setLevel("error");
        scope.setTag("logger", "writeMainLog");
        scope.setExtra("log_message", message);
        Sentry.captureException(error);
      });
      return;
    }
    Sentry.withScope((scope) => {
      scope.setLevel("error");
      scope.setTag("logger", "writeMainLog");
      Sentry.captureMessage(message);
    });
  } catch {
    // Never let Sentry reporting break the main process.
  } finally {
    sentryLogReportingActive = false;
  }
}

export function ensureMainLogPath(): string {
  if (mainLogPath) {
    return mainLogPath;
  }
  const logDir = resolve(resolveElectronIsolatedStateDir(), "electron", "logs");
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  mainLogPath = resolve(logDir, "main.log");
  return mainLogPath;
}

export function setMainLogSink(sink: MainLogSink | null): void {
  mainLogSink = sink;
}

export function writeMainLog(message: string, level: MainLogLevel = "info", error?: unknown): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  const writeLine = () => {
    const logPath = ensureMainLogPath();
    mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
    appendFileSync(logPath, line, "utf-8");
  };

  try {
    writeLine();
  } catch (writeError) {
    if ((writeError as NodeJS.ErrnoException)?.code === "ENOENT") {
      try {
        mainLogPath = null;
        writeLine();
      } catch {
        // Avoid recursive logging if file writes fail.
      }
    }
  }

  if (mainLogSink) {
    try {
      mainLogSink({ level, message });
    } catch {
      // Best effort only.
    }
  }

  if (level === "error") {
    captureSentryError(message, error);
  } else {
    addSentryBreadcrumb(mapLevelToSentry(level), message, "writeMainLog");
  }
}

export function writeMainInfo(...args: unknown[]): void {
  writeMainLog(args.map((arg) => formatLogArg(arg)).join(" ").trim() || "(empty log)", "info");
}

export function writeMainWarn(...args: unknown[]): void {
  writeMainLog(args.map((arg) => formatLogArg(arg)).join(" ").trim() || "(empty log)", "warn");
}

export function writeMainError(...args: unknown[]): void {
  const errorArg = args.find((arg) => arg instanceof Error);
  writeMainLog(
    args.map((arg) => formatLogArg(arg)).join(" ").trim() || "(empty log)",
    "error",
    errorArg,
  );
}
