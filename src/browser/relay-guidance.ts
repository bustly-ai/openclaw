import { formatCliCommand } from "../cli/command-format.js";
import { loadConfig } from "../config/config.js";
import { resolveConfigPathCandidate } from "../config/paths.js";
import type { ResolvedBrowserProfile } from "./config.js";

export const DEFAULT_RELAY_EXTENSION_DOWNLOAD_URL =
  "https://cdn.bustly.shop/static/browser-relay/bustly-browser-relay.zip";
const FALLBACK_OPENCLAW_CONFIG_PATH = "~/.bustly/openclaw.json";

const RELAY_DOWNLOAD_URL_ENV_KEYS = [
  "BUSTLY_BROWSER_RELAY_DOWNLOAD_URL",
  "OPENCLAW_BROWSER_RELAY_DOWNLOAD_URL",
] as const;

export type RelayGuidanceKind = "relay_unreachable" | "extension_not_connected" | "no_attached_tab";

function tryParseHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveRelayExtensionDownloadUrl(): string | null {
  for (const key of RELAY_DOWNLOAD_URL_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) {
      continue;
    }
    const parsed = tryParseHttpUrl(raw);
    if (parsed) {
      return parsed;
    }
  }
  try {
    const configured = loadConfig()?.browser?.relayExtensionDownloadUrl;
    if (typeof configured === "string" && configured.trim().length > 0) {
      const parsed = tryParseHttpUrl(configured);
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // ignore config read errors and fall back
  }
  return DEFAULT_RELAY_EXTENSION_DOWNLOAD_URL;
}

function resolveOpenClawConfigPathHint(): string {
  try {
    return resolveConfigPathCandidate();
  } catch {
    return FALLBACK_OPENCLAW_CONFIG_PATH;
  }
}

function parseRelayPort(cdpUrl: string): number | null {
  try {
    const parsed = new URL(cdpUrl);
    if (parsed.port.trim()) {
      const explicitPort = Number.parseInt(parsed.port, 10);
      return Number.isFinite(explicitPort) && explicitPort > 0 && explicitPort <= 65535
        ? explicitPort
        : null;
    }
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

function buildRelaySetupSteps(profile: ResolvedBrowserProfile): string[] {
  const downloadUrl = resolveRelayExtensionDownloadUrl();
  const configPath = resolveOpenClawConfigPathHint();
  const relayPort = parseRelayPort(profile.cdpUrl);
  const relayEndpoint = profile.cdpUrl.replace(/\/$/, "");
  const relayPortHint = relayPort ? String(relayPort) : "(from profile cdpUrl)";
  const statusCommand = formatCliCommand(`openclaw browser status --profile ${profile.name}`);
  const installCommand = formatCliCommand("openclaw browser extension install");

  return [
    downloadUrl
      ? `1) Install or update Bustly Browser Relay extension. Download: [Bustly Browser Relay](${downloadUrl})`
      : "1) Install or update Bustly Browser Relay extension.",
    "2) Upload it to Chrome: open chrome://extensions, enable Developer mode, then click Load unpacked (or drag/drop the package) and enable the extension.",
    `3) In extension settings, set relay port to ${relayPortHint} and gateway token from ${configPath} (gateway.auth.token), then click Save.`,
    `4) Keep relay enabled (status should be Connected at ${relayEndpoint}).`,
    "5) Open the target website in your normal browser window and click the Bustly Browser Relay toolbar icon on that tab (badge ON).",
    "6) Retry the browser action after the tab is attached.",
    `Debug CLI: ${statusCommand}`,
    `Bundled installer (optional): ${installCommand}`,
  ];
}

function titleForKind(kind: RelayGuidanceKind, profile: ResolvedBrowserProfile): string {
  const relayEndpoint = profile.cdpUrl.replace(/\/$/, "");
  if (kind === "extension_not_connected") {
    return `Local Bustly relay service is reachable at ${relayEndpoint}, but extension session is not connected (profile "${profile.name}"). This does not confirm extension installation. Possible causes: (1) extension not installed, (2) installed but not enabled on the target tab (badge not ON).`;
  }
  if (kind === "no_attached_tab") {
    return `Bustly Browser Relay is connected, but no browser tab is attached for profile "${profile.name}".`;
  }
  return `Bustly Browser Relay is not reachable at ${relayEndpoint} for profile "${profile.name}".`;
}

export function buildRelayGuidanceMessage(params: {
  profile: ResolvedBrowserProfile;
  kind: RelayGuidanceKind;
  detail?: string;
}): string {
  const title = titleForKind(params.kind, params.profile);
  const steps = buildRelaySetupSteps(params.profile);
  const lines = [title];
  if (params.detail?.trim()) {
    lines.push(`Detail: ${params.detail.trim()}`);
  }
  lines.push("Relay setup checklist:");
  for (const step of steps) {
    lines.push(step);
  }
  lines.push("Do NOT retry browser tools until the relay checklist is complete.");
  return lines.join("\n");
}
