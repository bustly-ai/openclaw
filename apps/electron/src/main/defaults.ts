import { homedir } from "node:os";
import { resolve } from "node:path";

export const ELECTRON_OPENCLAW_PROFILE = "bustly";
export const ELECTRON_DEFAULT_MODEL = "bustly/chat.standard";

export function getElectronOpenrouterApiKey(): string {
  return process.env.BUSTLY_BETA_OPENROUTER_API_KEY?.trim() || "";
}

export function resolveElectronIsolatedStateDir(): string {
  return resolve(homedir(), ".bustly");
}

export function resolveElectronIsolatedConfigPath(): string {
  return resolve(resolveElectronIsolatedStateDir(), "openclaw.json");
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveElectronBackendLogPath(date: Date = new Date()): string {
  return resolve(
    resolveElectronIsolatedStateDir(),
    "electron",
    "logs",
    `openclaw-${formatLocalDate(date)}.log`,
  );
}
