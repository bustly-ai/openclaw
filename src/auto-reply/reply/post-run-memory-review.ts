import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose } from "../../globals.js";
import { runWithModelFallback } from "../../agents/model-fallback.js";
import { isCliProvider } from "../../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import { resolveSandboxConfigForAgent, resolveSandboxRuntimeStatus } from "../../agents/sandbox.js";
import { collectTextContentBlocks } from "../../agents/content-blocks.js";
import { createSkillManageTool } from "../../agents/tools/skill-manage-tool.js";
import { searchSessionTranscripts } from "../../agents/tools/session-search-tool.js";
import type { TemplateContext } from "../templating.js";
import type { VerboseLevel } from "../thinking.js";
import { SILENT_REPLY_TOKEN } from "../tokens.js";
import type { GetReplyOptions } from "../types.js";
import type { FollowupRun } from "./queue.js";
import { registerAgentRunContext } from "../../infra/agent-events.js";
import {
  buildEmbeddedRunBaseParams,
  buildEmbeddedRunContexts,
  resolveModelFallbackOptions,
} from "./agent-runner-utils.js";
import { buildIsolatedInternalSessionId, withIsolatedSessionFile } from "./isolated-session-file.js";
import { readSessionMessages } from "./post-compaction-audit.js";

export const DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS = 5;
export const DEFAULT_POST_RUN_MEMORY_REVIEW_MAX_RECENT_MESSAGES = 120;

export const DEFAULT_POST_RUN_MEMORY_REVIEW_PROMPT = [
  "You are the consolidation classifier for a completed agent session.",
  "Return JSON only.",
  "Classify the completed work into exactly one layer: none, memory, skill, or retrieval_only.",
  "Use memory for durable facts, decisions, and preferences.",
  "Use skill for stable reusable procedures, SOPs, or repeatable playbooks.",
  "Use retrieval_only when the work should remain searchable precedent but should not yet become memory or skill.",
  "Promote to skill when the task is demonstrably repeated or when the work is clearly reusable procedural knowledge.",
  "Do not write files yourself. Do not emit prose outside JSON.",
].join(" ");

export const DEFAULT_POST_RUN_MEMORY_REVIEW_SYSTEM_PROMPT = [
  "Silent consolidation stage after a completed agent run.",
  "This stage is runtime-controlled, not user-visible.",
  "Your job is classification only: decide what should be stored and in which layer.",
  "Return one JSON object and nothing else.",
].join(" ");

export type PostRunMemoryReviewSettings = {
  enabled: boolean;
  minToolCalls: number;
  maxRecentMessages: number;
  allowInGroupChats: boolean;
  prompt: string;
  systemPrompt: string;
};

type TranscriptMessage = { role?: string; content?: unknown; text?: unknown };

type ReviewDecision = {
  shouldRun: boolean;
  trigger: "session_end" | "none";
  toolCallCount: number;
};

type ConsolidationLayer = "none" | "memory" | "skill" | "retrieval_only";

type ConsolidationClassification = {
  layer: ConsolidationLayer;
  reason: string;
  confidence: number;
  repeatedTask: boolean;
  summary: string;
  memory?: {
    target: "memory_md" | "daily_log";
    heading: string;
    body: string;
  };
  skill?: {
    skillName: string;
    description: string;
    body: string;
  };
};

type ConsolidationOutcome = {
  layer: ConsolidationLayer;
  reason: string;
  confidence: number;
  matchedPriorSessions: number;
  repeatedTask: boolean;
};

function ensureNoReplyHint(text: string): string {
  if (text.includes(SILENT_REPLY_TOKEN)) {
    return text;
  }
  return `${text}\n\nIf no storage is needed, output layer=none.`;
}

function normalizeNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const int = Math.floor(value);
  return int >= 0 ? int : null;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function cleanLine(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ");
}

function cleanParagraph(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .trim()
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function resolvePostRunMemoryReviewSettings(
  cfg?: OpenClawConfig,
): PostRunMemoryReviewSettings | null {
  const raw = cfg?.agents?.defaults?.selfEvolution;
  const enabled = raw?.enabled ?? true;
  if (!enabled) {
    return null;
  }
  return {
    enabled,
    minToolCalls:
      normalizeNonNegativeInt(raw?.minToolCalls) ?? DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS,
    maxRecentMessages:
      normalizeNonNegativeInt(raw?.maxRecentMessages) ??
      DEFAULT_POST_RUN_MEMORY_REVIEW_MAX_RECENT_MESSAGES,
    allowInGroupChats: raw?.allowInGroupChats ?? false,
    prompt: ensureNoReplyHint(raw?.prompt?.trim() || DEFAULT_POST_RUN_MEMORY_REVIEW_PROMPT),
    systemPrompt: ensureNoReplyHint(
      raw?.systemPrompt?.trim() || DEFAULT_POST_RUN_MEMORY_REVIEW_SYSTEM_PROMPT,
    ),
  };
}

function extractCurrentTurnMessages(messages: TranscriptMessage[]): TranscriptMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages.slice(index);
    }
  }
  return messages;
}

function extractMessageText(message: TranscriptMessage): string {
  const chunks: string[] = [];
  if (typeof message.content === "string") {
    chunks.push(message.content);
  }
  if (Array.isArray(message.content)) {
    chunks.push(...collectTextContentBlocks(message.content));
  }
  if (typeof message.text === "string") {
    chunks.push(message.text);
  }
  return chunks.map((part) => part.trim()).filter(Boolean).join("\n").trim();
}

function countToolResults(messages: TranscriptMessage[]): number {
  return messages.filter((message) => message.role === "toolResult").length;
}

function summarizeMessages(messages: TranscriptMessage[], maxChars: number): string {
  const text = messages
    .map((message) => {
      const body = extractMessageText(message);
      if (!body) {
        return "";
      }
      return `${message.role ?? "unknown"}: ${body}`;
    })
    .filter(Boolean)
    .join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function buildSearchQuery(messages: TranscriptMessage[]): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => extractMessageText(message))
    .filter(Boolean);
  const query = userMessages[userMessages.length - 1] ?? summarizeMessages(messages, 240);
  return query.trim();
}

export function decidePostRunMemoryReview(params: {
  transcriptMessages: TranscriptMessage[];
}): ReviewDecision {
  const currentTurn = extractCurrentTurnMessages(params.transcriptMessages);
  const toolCallCount = countToolResults(currentTurn);
  return {
    shouldRun: true,
    trigger: "session_end",
    toolCallCount,
  };
}

function extractFirstJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return candidate.slice(start, end + 1);
}

function normalizeClassification(raw: unknown): ConsolidationClassification {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const layerRaw = cleanLine(record.layer).toLowerCase();
  const layer: ConsolidationLayer =
    layerRaw === "memory" || layerRaw === "skill" || layerRaw === "retrieval_only"
      ? layerRaw
      : "none";
  const memoryRaw =
    record.memory && typeof record.memory === "object" && !Array.isArray(record.memory)
      ? (record.memory as Record<string, unknown>)
      : undefined;
  const skillRaw =
    record.skill && typeof record.skill === "object" && !Array.isArray(record.skill)
      ? (record.skill as Record<string, unknown>)
      : undefined;
  const memory =
    memoryRaw && cleanParagraph(memoryRaw.body)
      ? {
          target:
            cleanLine(memoryRaw.target) === "memory_md"
              ? ("memory_md" as const)
              : ("daily_log" as const),
          heading: cleanLine(memoryRaw.heading) || "Consolidated Notes",
          body: cleanParagraph(memoryRaw.body),
        }
      : undefined;
  const skill =
    skillRaw && cleanParagraph(skillRaw.body) && cleanLine(skillRaw.skillName)
      ? {
          skillName: cleanLine(skillRaw.skillName),
          description: cleanLine(skillRaw.description) || "Generated procedural skill",
          body: cleanParagraph(skillRaw.body),
        }
      : undefined;

  return {
    layer,
    reason: cleanLine(record.reason) || "unspecified",
    confidence: clampConfidence(record.confidence),
    repeatedTask: record.repeatedTask === true,
    summary: cleanParagraph(record.summary) || "No summary provided.",
    memory,
    skill,
  };
}

async function appendReviewLedger(params: {
  agentDir: string;
  sessionId: string;
  sessionKey?: string;
  trigger: ReviewDecision["trigger"];
  toolCallCount: number;
  changedMemory: boolean;
  changedSkills: boolean;
  reviewRunId: string;
  skipped?: string;
  outcome?: ConsolidationOutcome;
}) {
  const dir = path.join(params.agentDir, "evolution");
  const file = path.join(dir, "reviews.jsonl");
  await fs.mkdir(dir, { recursive: true });
  const row = {
    timestamp: new Date().toISOString(),
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    reviewRunId: params.reviewRunId,
    trigger: params.trigger,
    toolCallCount: params.toolCallCount,
    changedMemory: params.changedMemory,
    changedSkills: params.changedSkills,
    skipped: params.skipped,
    outcome: params.outcome,
  };
  await fs.appendFile(file, `${JSON.stringify(row)}\n`, "utf-8");
}

async function statMtimeMs(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtimeMs;
  } catch {
    return null;
  }
}

async function appendMarkdownSection(params: {
  filePath: string;
  title: string;
  body: string;
  preamble?: string;
}) {
  await fs.mkdir(path.dirname(params.filePath), { recursive: true });
  let existing = "";
  try {
    existing = await fs.readFile(params.filePath, "utf-8");
  } catch {}
  const heading = `## ${params.title.trim()}`;
  const section = `${heading}\n${params.body.trim()}\n`;
  if (existing.includes(section.trim())) {
    return;
  }
  const chunks: string[] = [];
  if (!existing.trim() && params.preamble?.trim()) {
    chunks.push(params.preamble.trim(), "");
  } else if (existing.trim()) {
    chunks.push(existing.trimEnd(), "");
  }
  chunks.push(section.trimEnd());
  await fs.writeFile(params.filePath, `${chunks.join("\n\n")}\n`, "utf-8");
}

async function applyMemoryWrite(params: {
  workspaceDir: string;
  memory: NonNullable<ConsolidationClassification["memory"]>;
}) {
  if (params.memory.target === "memory_md") {
    await appendMarkdownSection({
      filePath: path.join(params.workspaceDir, "MEMORY.md"),
      title: params.memory.heading,
      body: params.memory.body,
      preamble: "# Memory",
    });
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  await appendMarkdownSection({
    filePath: path.join(params.workspaceDir, "memory", `${stamp}.md`),
    title: params.memory.heading,
    body: params.memory.body,
    preamble: `# ${stamp}`,
  });
}

async function applySkillWrite(params: {
  workspaceDir: string;
  skill: NonNullable<ConsolidationClassification["skill"]>;
}) {
  const tool = createSkillManageTool({ workspaceDir: params.workspaceDir });
  if (!tool) {
    throw new Error("skill_manage unavailable");
  }
  await tool.execute("post-run-consolidation", {
    action: "upsert",
    skillName: params.skill.skillName,
    description: params.skill.description,
    body: params.skill.body,
  });
}

async function classifyConsolidation(params: {
  cfg: OpenClawConfig;
  followupRun: FollowupRun;
  sessionCtx: TemplateContext;
  opts?: GetReplyOptions;
  reviewRunId: string;
  reviewSessionId: string;
  defaultModel: string;
  settings: PostRunMemoryReviewSettings;
  currentTurn: TranscriptMessage[];
  currentTurnSummary: string;
  recentSessionSummary: string;
  matchedPriorSessions: number;
}) {
  const classificationSystemPrompt = [
    params.followupRun.run.extraSystemPrompt,
    params.settings.systemPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");
  const classificationPrompt = [
    params.settings.prompt,
    "",
    "Return exactly one JSON object with this shape:",
    `{
  "layer": "none" | "memory" | "skill" | "retrieval_only",
  "reason": string,
  "confidence": number,
  "repeatedTask": boolean,
  "summary": string,
  "memory": { "target": "memory_md" | "daily_log", "heading": string, "body": string } | null,
  "skill": { "skillName": string, "description": string, "body": string } | null
}`,
    "",
    `MatchedPriorSessions: ${params.matchedPriorSessions}`,
    "",
    "CurrentTurnTranscript:",
    params.currentTurnSummary || "(empty)",
    "",
    "SimilarPriorSessions:",
    params.recentSessionSummary || "(none)",
  ].join("\n");

  const result = await runWithModelFallback({
    ...resolveModelFallbackOptions(params.followupRun.run),
    run: (provider, model) => {
      const { authProfile, embeddedContext, senderContext } = buildEmbeddedRunContexts({
        run: params.followupRun.run,
        sessionCtx: params.sessionCtx,
        hasRepliedRef: params.opts?.hasRepliedRef,
        provider,
      });
      const runBaseParams = buildEmbeddedRunBaseParams({
        run: params.followupRun.run,
        provider,
        model,
        runId: params.reviewRunId,
        authProfile,
      });
      return withIsolatedSessionFile(
        params.followupRun.run.sessionFile,
        "post-run-review",
        (sessionFile) =>
          runEmbeddedPiAgent({
            ...embeddedContext,
            ...senderContext,
            ...runBaseParams,
            sessionId: params.reviewSessionId,
            sessionFile,
            prompt: classificationPrompt,
            extraSystemPrompt: classificationSystemPrompt,
            disableTools: true,
          }),
      );
    },
  });

  const text =
    result.result.payloads
      ?.map((payload: { text?: string | null }) => payload.text ?? "")
      .join("\n")
      .trim() ?? "";
  const jsonText = extractFirstJsonObject(text);
  if (!jsonText) {
    throw new Error(`structured consolidation returned no JSON: ${text.slice(0, 200)}`);
  }
  return normalizeClassification(JSON.parse(jsonText));
}

export function enforceRuntimeRouting(params: {
  classification: ConsolidationClassification;
  matchedPriorSessions: number;
  toolCallCount: number;
  settings: PostRunMemoryReviewSettings;
}): ConsolidationClassification {
  const repeatedTask =
    params.classification.repeatedTask || params.matchedPriorSessions > 0;
  const confidence = params.classification.confidence;

  if (confidence < 0.55) {
    return {
      ...params.classification,
      layer: "none",
      reason: "low_confidence",
    };
  }

  if (params.classification.layer === "skill") {
    const hasProcedureSignal =
      repeatedTask || params.toolCallCount >= params.settings.minToolCalls;
    if (!hasProcedureSignal || !params.classification.skill) {
      return {
        ...params.classification,
        layer: params.classification.memory ? "memory" : "none",
        reason: hasProcedureSignal ? "missing_skill_payload" : "insufficient_procedure_signal",
      };
    }
  }

  if (
    params.classification.layer === "memory" &&
    repeatedTask &&
    params.classification.skill
  ) {
    return {
      ...params.classification,
      layer: "skill",
      repeatedTask,
      reason: "runtime_promoted_repeated_procedure",
    };
  }

  if (params.classification.layer === "memory" && !params.classification.memory) {
    return {
      ...params.classification,
      layer: "none",
      reason: "missing_memory_payload",
    };
  }

  if (params.classification.layer === "retrieval_only" && params.matchedPriorSessions === 0) {
    return {
      ...params.classification,
      layer: "none",
      reason: "no_prior_sessions",
    };
  }

  return {
    ...params.classification,
    repeatedTask,
  };
}

export async function runPostRunMemoryReviewIfNeeded(params: {
  cfg: OpenClawConfig;
  followupRun: FollowupRun;
  sessionCtx: TemplateContext;
  opts?: GetReplyOptions;
  defaultModel: string;
  resolvedVerboseLevel: VerboseLevel;
  commandBody: string;
  sessionKey?: string;
  isHeartbeat: boolean;
}): Promise<void> {
  const settings = resolvePostRunMemoryReviewSettings(params.cfg);
  if (!settings) {
    return;
  }
  if (params.isHeartbeat) {
    return;
  }
  if (isCliProvider(params.followupRun.run.provider, params.cfg)) {
    return;
  }
  const chatType = params.sessionCtx.ChatType?.trim().toLowerCase();
  if (!settings.allowInGroupChats && chatType && chatType !== "direct") {
    return;
  }

  const reviewWritable = (() => {
    if (!params.sessionKey) {
      return true;
    }
    const runtime = resolveSandboxRuntimeStatus({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
    });
    if (!runtime.sandboxed) {
      return true;
    }
    const sandboxCfg = resolveSandboxConfigForAgent(params.cfg, runtime.agentId);
    return sandboxCfg.workspaceAccess === "rw";
  })();
  if (!reviewWritable) {
    return;
  }

  const transcriptMessages = readSessionMessages(
    params.followupRun.run.sessionFile,
    settings.maxRecentMessages,
  );
  const decision = decidePostRunMemoryReview({
    transcriptMessages,
  });
  if (!decision.shouldRun) {
    return;
  }

  const currentTurn = extractCurrentTurnMessages(transcriptMessages);
  const searchQuery = buildSearchQuery(currentTurn);
  const priorSessions = searchQuery
    ? searchSessionTranscripts({
        query: searchQuery,
        maxResults: 3,
        maxSessions: 25,
        excludeCurrentSession: true,
        agentSessionKey: params.sessionKey,
      })
    : { query: "", searchedSessions: 0, results: [] };
  const matchedSessionKeys = new Set(priorSessions.results.map((item) => item.sessionKey));
  const matchedPriorSessions = matchedSessionKeys.size;

  const reviewRunId = crypto.randomUUID();
  if (params.sessionKey) {
    registerAgentRunContext(reviewRunId, {
      sessionKey: params.sessionKey,
      verboseLevel: params.resolvedVerboseLevel,
      uiVisibility: "hidden",
      silentReason: "post-run-review",
    });
  }

  const workspaceDir = params.followupRun.run.workspaceDir;
  const memoryFile = path.join(workspaceDir, "MEMORY.md");
  const dailyMemoryFile = path.join(workspaceDir, "memory");
  const skillsDir = path.join(workspaceDir, "skills");
  const beforeMemoryMtime = await statMtimeMs(memoryFile);
  const beforeDailyDirMtime = await statMtimeMs(dailyMemoryFile);
  const beforeSkillsDirMtime = await statMtimeMs(skillsDir);
  const reviewSessionId = buildIsolatedInternalSessionId(
    params.followupRun.run.sessionId,
    "post-run-review",
    reviewRunId,
  );

  let outcome: ConsolidationOutcome | undefined;

  try {
    const classification = await classifyConsolidation({
      cfg: params.cfg,
      followupRun: params.followupRun,
      sessionCtx: params.sessionCtx,
      opts: params.opts,
      reviewRunId,
      reviewSessionId,
      defaultModel: params.defaultModel,
      settings,
      currentTurn,
      currentTurnSummary: summarizeMessages(currentTurn, 5000),
      recentSessionSummary: priorSessions.results
        .map(
          (item, index) =>
            `${index + 1}. session=${item.sessionKey} role=${item.role ?? "unknown"} score=${item.score}\n${item.snippet}`,
        )
        .join("\n\n"),
      matchedPriorSessions,
    });
    const routed = enforceRuntimeRouting({
      classification,
      matchedPriorSessions,
      toolCallCount: decision.toolCallCount,
      settings,
    });

    if (routed.layer === "memory" && routed.memory) {
      await applyMemoryWrite({
        workspaceDir,
        memory: routed.memory,
      });
    } else if (routed.layer === "skill" && routed.skill) {
      await applySkillWrite({
        workspaceDir,
        skill: routed.skill,
      });
    }

    outcome = {
      layer: routed.layer,
      reason: routed.reason,
      confidence: routed.confidence,
      matchedPriorSessions,
      repeatedTask: routed.repeatedTask,
    };
  } catch (err) {
    logVerbose(`post-run consolidation failed: ${String(err)}`);
    try {
      await appendReviewLedger({
        agentDir: params.followupRun.run.agentDir,
        sessionId: params.followupRun.run.sessionId,
        sessionKey: params.sessionKey,
        trigger: decision.trigger,
        toolCallCount: decision.toolCallCount,
        changedMemory: false,
        changedSkills: false,
        reviewRunId,
        skipped: String(err),
        outcome,
      });
    } catch {
      // Best effort only.
    }
    return;
  }

  const afterMemoryMtime = await statMtimeMs(memoryFile);
  const afterDailyDirMtime = await statMtimeMs(dailyMemoryFile);
  const afterSkillsDirMtime = await statMtimeMs(skillsDir);
  const changedMemory =
    beforeMemoryMtime !== afterMemoryMtime || beforeDailyDirMtime !== afterDailyDirMtime;
  const changedSkills = beforeSkillsDirMtime !== afterSkillsDirMtime;

  try {
    await appendReviewLedger({
      agentDir: params.followupRun.run.agentDir,
      sessionId: params.followupRun.run.sessionId,
      sessionKey: params.sessionKey,
      trigger: decision.trigger,
      toolCallCount: decision.toolCallCount,
      changedMemory,
      changedSkills,
      reviewRunId,
      outcome,
    });
  } catch (err) {
    logVerbose(`failed to persist post-run review ledger: ${String(err)}`);
  }
}
