import { homedir } from "node:os";
import { resolve } from "node:path";

export const ELECTRON_OPENCLAW_PROFILE = "bustly";
export const ELECTRON_DEFAULT_MODEL = "openrouter/minimax/minimax-m2.5";
export const ELECTRON_BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_PROD =
  "https://raw.githubusercontent.com/salerio-ai/bustly-prompts/main/openclaw-prompts";
export const ELECTRON_BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_TEST =
  "https://raw.githubusercontent.com/salerio-ai/bustly-prompts/testing/openclaw-prompts";

function normalizeVersion(value: string | undefined): string {
  return value?.trim() || "";
}

export function isElectronBetaVersion(version: string | undefined): boolean {
  return normalizeVersion(version).toLowerCase().includes("beta");
}

export function resolveElectronBustlyWorkspaceTemplateBaseUrl(version: string | undefined): string {
  return isElectronBetaVersion(version)
    ? ELECTRON_BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_TEST
    : ELECTRON_BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_PROD;
}

export function getElectronOpenrouterApiKey(): string {
  return process.env.BUSTLY_BETA_OPENROUTER_API_KEY?.trim() || "";
}

export function resolveElectronIsolatedStateDir(): string {
  return resolve(homedir(), ".bustly");
}

export function resolveElectronIsolatedConfigPath(): string {
  return resolve(resolveElectronIsolatedStateDir(), "openclaw.json");
}
