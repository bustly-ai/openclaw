import { randomUUID } from "node:crypto";
import { stream, type AssistantMessage, type Message } from "@mariozechner/pi-ai";
import { BUSTLY_PROVIDER_ID } from "../agents/bustly-models.js";
import { mergeBustlyRuntimeHeaders } from "../agents/bustly-runtime-headers.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { resolveModel } from "../agents/pi-embedded-runner/model.js";
import type { OpenClawConfig } from "../config/types.js";
import { loadSessionStore, updateSessionStore } from "../config/sessions.js";
import { resolveDefaultSessionStorePath } from "../config/sessions/paths.js";
import { applySessionsPatchToStore } from "../gateway/sessions-patch.js";
import { runTrackedModelRequest } from "../infra/model-request-adapter.js";
import { isTransientNetworkError } from "../infra/unhandled-rejections.js";
import { readBustlyOAuthState } from "../bustly-oauth.js";
import { bustlySupabaseFetch } from "./supabase.js";
import { normalizeBustlyWorkspaceId } from "./workspace-agent.js";

const SESSION_TITLE_MAX_TOKENS = 24;
const SESSION_TITLE_TIMEOUT_MS = 20_000;
const SESSION_TITLE_MODEL_ID = process.env.BUSTLY_SESSION_TITLE_MODEL_ID?.trim() || "chat.standard";
const SESSION_TITLE_BLOCKED_SUBSTRINGS = ["/admin?setting_modal=billing", "model access"];
const SESSION_TITLE_SYSTEM_PROMPT = [
  "Extract a concise task title from the user request text.",
  "The title must describe the user's intended task, not an assistant response.",
  "Do not answer, refuse, apologize, or explain capability limits.",
  "Use the same language and script as the request; if uncertain, use English.",
  "Return only the title text.",
  "Avoid quotes, markdown, emojis, numbering, boilerplate, and trailing punctuation.",
  'Avoid generic titles like "Conversation", "New conversation", "Help", or "Task".',
  "Bad title example: I cannot generate or open images",
  "Good title example: Generate and open a SpongeBob image",
  "Prefer 2-8 words for spaced languages.",
].join("\n");

const pendingSessionTitleJobs = new Map<string, Promise<void>>();

export type BustlySessionLabelUpdatedPayload = {
  agentId: string;
  sessionKey: string;
  label: string;
  updatedAt: number | null;
};

type ScheduleBustlySessionTitleParams = {
  workspaceId: string;
  agentId: string;
  sessionKey: string;
  sessionId: string;
  seedLabel: string;
  promptExcerpt?: string;
  sampleRouteKey?: string;
  cfg: OpenClawConfig;
  onLabelUpdated?: (payload: BustlySessionLabelUpdatedPayload) => void;
};

export type GenerateBustlySessionTitleParams = {
  promptExcerpt?: string;
  cfg: OpenClawConfig;
  workspaceId: string;
  sessionId: string;
  sessionKey: string;
};

export type BustlySessionTitleFailureReason =
  | "invalid_input"
  | "model_unavailable"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "invalid_output";

export type BustlySessionTitleGenerationResult =
  | { ok: true; title: string }
  | { ok: false; reason: BustlySessionTitleFailureReason };

export type UpsertBustlySessionTitleExtractParams = {
  workspaceId: string;
  sessionId: string;
  sessionName: string;
  sampleRouteKey?: string;
  promptExcerpt?: string;
};

function resolveSessionTitleWorkspaceId(rawWorkspaceId: string): string {
  const trimmedWorkspaceId = rawWorkspaceId.trim();
  if (!trimmedWorkspaceId) {
    return "";
  }
  const oauthWorkspaceId = readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
  if (!oauthWorkspaceId) {
    return trimmedWorkspaceId;
  }
  const normalizedInput = normalizeBustlyWorkspaceId(trimmedWorkspaceId);
  const normalizedOauth = normalizeBustlyWorkspaceId(oauthWorkspaceId);
  if (normalizedInput && normalizedInput === normalizedOauth) {
    return oauthWorkspaceId;
  }
  return trimmedWorkspaceId;
}

function extractAssistantText(message: AssistantMessage): string {
  return message.content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      if (block.type === "text") {
        return typeof block.text === "string" ? block.text : "";
      }
      return "";
    })
    .join("")
    .trim();
}

function normalizeGeneratedSessionTitle(value: string): string | null {
  const normalized = value
    .replace(/[\r\n]+/g, " ")
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, "")
    .replace(/[.。!！?？]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  if (["conversation", "new conversation", "help", "task"].includes(lower)) {
    return null;
  }
  if (SESSION_TITLE_BLOCKED_SUBSTRINGS.some((token) => lower.includes(token))) {
    return null;
  }
  return normalized;
}

export function normalizeBustlySessionPromptExcerpt(value: string | undefined): string {
  const normalized = value?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return normalized.slice(0, 500);
}

export function normalizeBustlySessionSampleRouteKey(value: string | undefined): string {
  return value?.trim() || "manual";
}

export async function generateBustlySessionTitleWithStatus(
  params: GenerateBustlySessionTitleParams,
): Promise<BustlySessionTitleGenerationResult> {
  const workspaceId = resolveSessionTitleWorkspaceId(params.workspaceId);
  const sessionId = params.sessionId.trim();
  const sessionKey = params.sessionKey.trim();
  const promptExcerpt = normalizeBustlySessionPromptExcerpt(params.promptExcerpt);
  if (!workspaceId || !sessionId || !sessionKey || !promptExcerpt) {
    return { ok: false, reason: "invalid_input" };
  }
  return await generateSessionTitleWithStatus({
    promptExcerpt,
    cfg: params.cfg,
    workspaceId,
    sessionId,
    sessionKey,
  });
}

export async function generateBustlySessionTitle(
  params: GenerateBustlySessionTitleParams,
): Promise<string | null> {
  const result = await generateBustlySessionTitleWithStatus(params);
  return result.ok ? result.title : null;
}

async function generateSessionTitleWithStatus(params: {
  promptExcerpt: string;
  cfg: OpenClawConfig;
  workspaceId: string;
  sessionId: string;
  sessionKey: string;
}): Promise<BustlySessionTitleGenerationResult> {
  const resolved = resolveModel(BUSTLY_PROVIDER_ID, SESSION_TITLE_MODEL_ID, undefined, params.cfg);
  if (!resolved.model) {
    return { ok: false, reason: "model_unavailable" };
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, SESSION_TITLE_TIMEOUT_MS);
  const runId = `session-title-${randomUUID()}`;
  const headers = mergeBustlyRuntimeHeaders({
    modelHeaders: (resolved.model as { headers?: Record<string, string> }).headers,
    workspaceId: params.workspaceId,
    runId,
    sessionId: params.sessionId,
  });
  const titleTaskPrompt = [
    "Extract a short task title for this request.",
    "Use the same language as the request text. If uncertain, use English.",
    "The title must capture the user's intent, not an assistant reply.",
    "",
    "Request:",
    params.promptExcerpt,
    "",
    "Only return the task title.",
  ].join("\n");
  const messages: Message[] = [
    {
      role: "user",
      content: [{ type: "text", text: titleTaskPrompt }],
      timestamp: Date.now(),
    },
  ];

  try {
    const apiKey = requireApiKey(
      await getApiKeyForModel({
        model: resolved.model,
        cfg: params.cfg,
      }),
      BUSTLY_PROVIDER_ID,
    );
    const eventStream = await Promise.resolve(
      runTrackedModelRequest({
        runId,
        request: stream,
        model: {
          ...resolved.model,
          reasoning: false,
        },
        context: {
          systemPrompt: SESSION_TITLE_SYSTEM_PROMPT,
          messages,
          tools: [],
        },
        options: {
          apiKey,
          maxTokens: SESSION_TITLE_MAX_TOKENS,
          temperature: 0,
          signal: controller.signal,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        },
        payloadLog: {
          sessionId: params.sessionId,
          sessionKey: params.sessionKey,
          provider: resolved.model.provider,
          modelId: resolved.model.id,
          modelApi: resolved.model.api,
        },
      }),
    );
    const message = await eventStream.result();
    const stopReason = typeof (message as { stopReason?: unknown }).stopReason === "string"
      ? (message as { stopReason: string }).stopReason
      : "";
    if (stopReason === "aborted") {
      return { ok: false, reason: didTimeout || controller.signal.aborted ? "timeout" : "provider_error" };
    }
    if (stopReason === "error") {
      return { ok: false, reason: "provider_error" };
    }
    const normalizedTitle = normalizeGeneratedSessionTitle(extractAssistantText(message));
    if (!normalizedTitle) {
      return { ok: false, reason: "invalid_output" };
    }
    return { ok: true, title: normalizedTitle };
  } catch (error) {
    if (didTimeout || controller.signal.aborted) {
      return { ok: false, reason: "timeout" };
    }
    if (isTransientNetworkError(error)) {
      return { ok: false, reason: "network_error" };
    }
    return { ok: false, reason: "provider_error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertSessionNameExtract(params: {
  workspaceId: string;
  sessionId: string;
  sessionName: string;
  sampleRouteKey: string;
  promptExcerpt: string;
}): Promise<void> {
  const body = JSON.stringify([
    {
      workspace_id: params.workspaceId,
      session_id: params.sessionId,
      session_name: params.sessionName,
      sample_route_key: params.sampleRouteKey,
      prompt_excerpt: params.promptExcerpt,
    },
  ]);
  const response = await bustlySupabaseFetch({
    path: "/rest/v1/workspace_session_name_extracts?on_conflict=workspace_id,session_id",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `workspace_session_name_extracts upsert failed: status=${response.status} body=${text}`,
    );
  }
}

export async function upsertBustlySessionTitleExtract(
  params: UpsertBustlySessionTitleExtractParams,
): Promise<void> {
  const workspaceId = resolveSessionTitleWorkspaceId(params.workspaceId);
  const sessionId = params.sessionId.trim();
  const sessionName = normalizeGeneratedSessionTitle(params.sessionName);
  const sampleRouteKey = normalizeBustlySessionSampleRouteKey(params.sampleRouteKey);
  const promptExcerpt = normalizeBustlySessionPromptExcerpt(params.promptExcerpt);
  if (!workspaceId || !sessionId || !sessionName || !promptExcerpt) {
    return;
  }
  await upsertSessionNameExtract({
    workspaceId,
    sessionId,
    sessionName,
    sampleRouteKey,
    promptExcerpt,
  });
}

async function applySessionTitle(params: {
  cfg: OpenClawConfig;
  agentId: string;
  sessionKey: string;
  sessionId: string;
  seedLabel: string;
  generatedTitle: string;
}): Promise<{ status: "updated" | "unchanged" | "conflict" | "missing" | "rejected"; updatedAt: number | null }> {
  const storePath = resolveDefaultSessionStorePath(params.agentId);
  return await updateSessionStore(storePath, async (store) => {
    const currentEntry = store[params.sessionKey];
    if (!currentEntry || currentEntry.sessionId !== params.sessionId) {
      return { status: "missing" as const, updatedAt: null };
    }

    const currentLabel = currentEntry.label?.trim() || "New conversation";
    if (currentLabel !== params.seedLabel) {
      return { status: "conflict" as const, updatedAt: currentEntry.updatedAt ?? null };
    }
    if (currentLabel === params.generatedTitle) {
      return { status: "unchanged" as const, updatedAt: currentEntry.updatedAt ?? null };
    }

    const patched = await applySessionsPatchToStore({
      cfg: params.cfg,
      store,
      storeKey: params.sessionKey,
      patch: {
        key: params.sessionKey,
        label: params.generatedTitle,
      },
    });
    if (!patched.ok) {
      return { status: "rejected" as const, updatedAt: currentEntry.updatedAt ?? null };
    }

    store[params.sessionKey] = patched.entry;
    return { status: "updated" as const, updatedAt: patched.entry.updatedAt ?? null };
  });
}

export function scheduleBustlySessionTitleGeneration(params: ScheduleBustlySessionTitleParams): void {
  const workspaceId = resolveSessionTitleWorkspaceId(params.workspaceId);
  const agentId = params.agentId.trim();
  const sessionKey = params.sessionKey.trim();
  const sessionId = params.sessionId.trim();
  const seedLabel = params.seedLabel.trim();
  const directPromptExcerpt = normalizeBustlySessionPromptExcerpt(params.promptExcerpt);
  const promptExcerpt = directPromptExcerpt || normalizeBustlySessionPromptExcerpt(seedLabel);
  const sampleRouteKey = normalizeBustlySessionSampleRouteKey(params.sampleRouteKey);

  if (!workspaceId || !agentId || !sessionKey || !sessionId || !seedLabel || !promptExcerpt) {
    return;
  }
  if (pendingSessionTitleJobs.has(sessionKey)) {
    return;
  }

  const job = (async () => {
    const latestEntry = loadSessionStore(resolveDefaultSessionStorePath(agentId))[sessionKey];
    if (!latestEntry || latestEntry.sessionId !== sessionId) {
      return;
    }

    const generatedTitle = await generateBustlySessionTitle({
      promptExcerpt,
      cfg: params.cfg,
      workspaceId,
      sessionId,
      sessionKey,
    });
    const resolvedSessionName = generatedTitle || promptExcerpt;

    let applied:
      | { status: "updated" | "unchanged" | "conflict" | "missing" | "rejected"; updatedAt: number | null }
      | null = null;
    if (generatedTitle) {
      applied = await applySessionTitle({
        cfg: params.cfg,
        agentId,
        sessionKey,
        sessionId,
        seedLabel,
        generatedTitle,
      });
      if (applied.status === "missing" || applied.status === "rejected") {
        return;
      }
    }

    try {
      await upsertSessionNameExtract({
        workspaceId,
        sessionId,
        sessionName: resolvedSessionName,
        sampleRouteKey,
        promptExcerpt,
      });
    } catch {
      // Best effort; the local session label has already been updated.
    }

    if (generatedTitle && applied?.status === "updated") {
      params.onLabelUpdated?.({
        agentId,
        sessionKey,
        label: generatedTitle,
        updatedAt: applied.updatedAt,
      });
    }
  })()
    .catch(() => {})
    .finally(() => {
      pendingSessionTitleJobs.delete(sessionKey);
    });

  pendingSessionTitleJobs.set(sessionKey, job);
}
