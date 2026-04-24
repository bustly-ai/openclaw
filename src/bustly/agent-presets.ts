import {
  normalizeBustlyAgentMetadata,
  type BustlyAgentUseCase,
  type BustlyAgentMetadata,
} from "../agents/bustly-agent-metadata.js";
import { loadRemoteWorkspaceTemplate } from "../agents/workspace-remote-templates.js";
import { normalizeBustlyAgentName } from "./workspace-agent.js";

export type BustlyRemoteAgentPreset = {
  slug: string;
};
export type BustlyRemoteUseCase = BustlyAgentUseCase;

type BustlyAgentPresetLoaderOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  onWarn?: (message: string, extra?: unknown) => void;
};

let presetsPromise: Promise<BustlyRemoteAgentPreset[]> | null = null;
const AGENT_CONFIG_PATH = "agents/config.json";

const FALLBACK_AGENT_PRESETS: BustlyRemoteAgentPreset[] = [
  { slug: "finance" },
  { slug: "customers" },
  { slug: "store-ops" },
  { slug: "marketing" },
];

function cloneFallbackPresets(): BustlyRemoteAgentPreset[] {
  return FALLBACK_AGENT_PRESETS.map((entry) => ({ ...entry }));
}

function logPresetWarning(
  options: BustlyAgentPresetLoaderOptions,
  message: string,
  extra?: unknown,
): void {
  if (options.onWarn) {
    options.onWarn(message, extra);
    return;
  }
  if (extra === undefined) {
    console.warn(`[Bustly Agent Presets] ${message}`);
    return;
  }
  console.warn(`[Bustly Agent Presets] ${message}`, extra);
}

async function loadBustlyPromptFile(
  name: string,
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<string | undefined> {
  return await loadRemoteWorkspaceTemplate(name, {
    env: options.env,
    fetchImpl: options.fetchImpl,
  });
}

function validatePresets(raw: unknown): BustlyRemoteAgentPreset[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Bustly agent config must be a non-empty array.");
  }

  const presets: BustlyRemoteAgentPreset[] = [];
  for (const entry of raw) {
    const rawSlug = typeof entry === "string" ? entry.trim() : "";
    if (!rawSlug) {
      continue;
    }
    const slug = normalizeBustlyAgentName(rawSlug);
    if (!slug) {
      continue;
    }
    presets.push({ slug });
  }

  if (presets.length === 0) {
    throw new Error("Bustly agent config has no valid agents.");
  }
  return presets;
}

export async function loadBustlyRemoteAgentPresets(
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyRemoteAgentPreset[]> {
  if (!presetsPromise) {
    presetsPromise = (async () => {
      try {
        const raw = await loadBustlyPromptFile(AGENT_CONFIG_PATH, options);
        if (!raw?.trim()) {
          throw new Error(`Missing Bustly agent config at ${AGENT_CONFIG_PATH}.`);
        }
        const parsed = JSON.parse(raw);
        return validatePresets(parsed);
      } catch (error) {
        logPresetWarning(options, "remote config unavailable; using bundled fallback presets", {
          error: error instanceof Error ? error.message : String(error),
        });
        return cloneFallbackPresets();
      }
    })();
  }
  return await presetsPromise;
}

export async function loadEnabledBustlyRemoteAgentPresets(
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyRemoteAgentPreset[]> {
  return await loadBustlyRemoteAgentPresets(options);
}

export async function loadBustlyMainAgentPreset(
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyRemoteAgentPreset> {
  const presets = await loadEnabledBustlyRemoteAgentPresets(options);
  const preferredNonOverview = presets.find((entry) => entry.slug !== "overview");
  return preferredNonOverview ?? presets[0];
}

export function resetBustlyRemoteAgentPresetsCache(): void {
  presetsPromise = null;
}

export async function loadBustlyRemoteAgentMetadata(
  agentName: string,
  options: BustlyAgentPresetLoaderOptions = {},
): Promise<BustlyAgentMetadata> {
  const normalizedAgentName = normalizeBustlyAgentName(agentName);
  const metadataPath = `agents/${normalizedAgentName}/.bustly-agent.json`;
  const raw = await loadBustlyPromptFile(metadataPath, options);
  if (!raw?.trim()) {
    throw new Error(`Missing Bustly agent metadata at ${metadataPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid Bustly agent metadata at ${metadataPath}.`, {
      cause: error,
    });
  }

  const metadata = normalizeBustlyAgentMetadata(parsed);
  if (!metadata.label) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include label.`);
  }
  if (!metadata.icon) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include icon.`);
  }
  if (metadata.skills === undefined) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include skills.`);
  }
  if (metadata.useCases === undefined) {
    throw new Error(`Bustly agent metadata at ${metadataPath} must include useCases.`);
  }
  return metadata;
}
