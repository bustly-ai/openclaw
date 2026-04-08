import { randomUUID } from "node:crypto";
import { stream, type AssistantMessage, type Message } from "@mariozechner/pi-ai";
import {
  BUSTLY_PROVIDER_ID,
} from "../../../../src/agents/bustly-models";
import { mergeBustlyRuntimeHeaders } from "../../../../src/agents/bustly-runtime-headers";
import { getApiKeyForModel, requireApiKey } from "../../../../src/agents/model-auth";
import { resolveModel } from "../../../../src/agents/pi-embedded-runner/model";
import type { OpenClawConfig } from "../../../../src/config/types";
import { loadSessionStore, updateSessionStore } from "../../../../src/config/sessions";
import { resolveDefaultSessionStorePath } from "../../../../src/config/sessions/paths";
import { applySessionsPatchToStore } from "../../../../src/gateway/sessions-patch";
import { runTrackedModelRequest } from "../../../../src/infra/model-request-adapter";
import { normalizeBustlyWorkspaceId } from "../shared/bustly-agent.js";
import {
  normalizeGeneratedSessionTitle,
  normalizeSampleRouteKey,
  normalizeSessionPromptExcerpt,
} from "../shared/bustly-session-title.js";
import { supabaseFetch } from "./api/bustly.js";
import { readBustlyOAuthState, refreshBustlyAccessToken } from "./bustly-oauth.js";
import { writeMainInfo, writeMainWarn } from "./logger.js";

const SESSION_TITLE_MAX_TOKENS = 24;
const SESSION_TITLE_TIMEOUT_MS = 20_000;
const SESSION_TITLE_MODEL_ID = process.env.BUSTLY_SESSION_TITLE_MODEL_ID?.trim() || "chat.advanced";
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

async function generateSessionTitle(params: {
  promptExcerpt: string;
  cfg: OpenClawConfig;
  workspaceId: string;
  sessionId: string;
  sessionKey: string;
}): Promise<string | null> {
  const resolved = resolveModel(BUSTLY_PROVIDER_ID, SESSION_TITLE_MODEL_ID, undefined, params.cfg);
  if (!resolved.model) {
    writeMainWarn("[Bustly Session Title] Skipped title generation: model unresolved");
    return null;
  }

  const apiKey = requireApiKey(
    await getApiKeyForModel({
      model: resolved.model,
      cfg: params.cfg,
    }),
    BUSTLY_PROVIDER_ID,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_TITLE_TIMEOUT_MS);
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
    writeMainInfo(
      `[Bustly Session Title] Generating title sessionKey=${params.sessionKey} sessionId=${params.sessionId} model=${resolved.model.provider}/${resolved.model.id}`,
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
    const errorMessage = typeof (message as { errorMessage?: unknown }).errorMessage === "string"
      ? (message as { errorMessage: string }).errorMessage.trim()
      : "";
    if (stopReason === "error" || stopReason === "aborted") {
      writeMainWarn(
        `[Bustly Session Title] Title generation returned ${stopReason} sessionKey=${params.sessionKey} sessionId=${params.sessionId} error=${errorMessage || "(none)"}`,
      );
      return null;
    }
    const generatedTitle = normalizeGeneratedSessionTitle(extractAssistantText(message));
    if (!generatedTitle) {
      writeMainWarn(
        `[Bustly Session Title] Model response produced no usable title sessionKey=${params.sessionKey} sessionId=${params.sessionId}`,
      );
      return null;
    }
    writeMainInfo(
      `[Bustly Session Title] Generated title sessionKey=${params.sessionKey} sessionId=${params.sessionId} title=${JSON.stringify(generatedTitle)}`,
    );
    return generatedTitle;
  } catch (error) {
    writeMainWarn(
      `[Bustly Session Title] Title generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await supabaseFetch({
      path: "/rest/v1/workspace_session_name_extracts?on_conflict=workspace_id,session_id",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body,
    });
    if (response.ok) {
      writeMainInfo(
        `[Bustly Session Title] Upserted workspace_session_name_extracts sessionId=${params.sessionId} sampleRouteKey=${params.sampleRouteKey}`,
      );
      return;
    }

    if (response.status === 401 && attempt === 0) {
      const refreshed = await refreshBustlyAccessToken();
      if (refreshed) {
        continue;
      }
    }

    const text = await response.text().catch(() => "");
    throw new Error(
      `workspace_session_name_extracts upsert failed: status=${response.status} body=${text}`,
    );
  }
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
      writeMainWarn(`[Bustly Session Title] Label patch rejected: ${patched.error.message}`);
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
  const directPromptExcerpt = normalizeSessionPromptExcerpt(params.promptExcerpt);
  const promptExcerpt = directPromptExcerpt || normalizeSessionPromptExcerpt(seedLabel);
  const sampleRouteKey = normalizeSampleRouteKey(params.sampleRouteKey);

  if (!workspaceId || !agentId || !sessionKey || !sessionId || !seedLabel || !promptExcerpt) {
    writeMainWarn(
      `[Bustly Session Title] Skipped scheduling workspaceId=${workspaceId || "(empty)"} agentId=${agentId || "(empty)"} sessionKey=${sessionKey || "(empty)"} sessionId=${sessionId || "(empty)"} hasSeedLabel=${seedLabel ? "yes" : "no"} hasPromptExcerpt=${promptExcerpt ? "yes" : "no"}`,
    );
    return;
  }
  if (pendingSessionTitleJobs.has(sessionKey)) {
    writeMainInfo(`[Bustly Session Title] Job already pending sessionKey=${sessionKey} sessionId=${sessionId}`);
    return;
  }
  if (!directPromptExcerpt) {
    writeMainInfo(
      `[Bustly Session Title] Falling back to seed label for prompt excerpt sessionKey=${sessionKey} sessionId=${sessionId}`,
    );
  }
  writeMainInfo(
    `[Bustly Session Title] Scheduled sessionKey=${sessionKey} sessionId=${sessionId} sampleRouteKey=${sampleRouteKey}`,
  );

  const job = (async () => {
    const latestEntry = loadSessionStore(resolveDefaultSessionStorePath(agentId))[sessionKey];
    if (!latestEntry || latestEntry.sessionId !== sessionId) {
      writeMainWarn(
        `[Bustly Session Title] Session entry missing before generation sessionKey=${sessionKey} sessionId=${sessionId}`,
      );
      return;
    }

    const generatedTitle = await generateSessionTitle({
      promptExcerpt,
      cfg: params.cfg,
      workspaceId,
      sessionId,
      sessionKey,
    });
    if (!generatedTitle) {
      return;
    }

    const applied = await applySessionTitle({
      cfg: params.cfg,
      agentId,
      sessionKey,
      sessionId,
      seedLabel,
      generatedTitle,
    });
    if (applied.status === "missing" || applied.status === "rejected") {
      writeMainWarn(
        `[Bustly Session Title] Title application aborted sessionKey=${sessionKey} sessionId=${sessionId} status=${applied.status}`,
      );
      return;
    }
    writeMainInfo(
      `[Bustly Session Title] Title application result sessionKey=${sessionKey} sessionId=${sessionId} status=${applied.status}`,
    );

    try {
      await upsertSessionNameExtract({
        workspaceId,
        sessionId,
        sessionName: generatedTitle,
        sampleRouteKey,
        promptExcerpt,
      });
    } catch (error) {
      writeMainWarn(
        `[Bustly Session Title] Supabase upsert failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (applied.status === "updated") {
      writeMainInfo(
        `[Bustly Session Title] Emitting renderer update sessionKey=${sessionKey} sessionId=${sessionId} title=${JSON.stringify(generatedTitle)}`,
      );
      params.onLabelUpdated?.({
        agentId,
        sessionKey,
        label: generatedTitle,
        updatedAt: applied.updatedAt,
      });
    }
  })()
    .catch((error) => {
      writeMainWarn(
        `[Bustly Session Title] Background job failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    })
    .finally(() => {
      pendingSessionTitleJobs.delete(sessionKey);
    });

  pendingSessionTitleJobs.set(sessionKey, job);
}
