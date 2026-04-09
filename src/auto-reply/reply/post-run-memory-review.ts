import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose } from "../../globals.js";
import { runWithModelFallback } from "../../agents/model-fallback.js";
import { isCliProvider } from "../../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import { resolveSandboxConfigForAgent, resolveSandboxRuntimeStatus } from "../../agents/sandbox.js";
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
import { resolveMemoryFlushPromptForRun } from "./memory-flush.js";

export const DEFAULT_POST_RUN_MEMORY_REVIEW_MIN_TOOL_CALLS = 5;
export const DEFAULT_POST_RUN_MEMORY_REVIEW_MAX_RECENT_MESSAGES = 120;

export const DEFAULT_POST_RUN_MEMORY_REVIEW_PROMPT = [
  "Post-run memory review.",
  "Every completed run gets a silent review.",
  "Review the just-finished turn and decide whether anything is worth saving or codifying.",
  "If prior sessions may contain precedent, use session_search before deciding what is genuinely new.",
  "Write stable preferences, project decisions, and reusable facts to MEMORY.md.",
  "Write short-lived execution notes or current context to memory/YYYY-MM-DD.md.",
  "If the turn produced a stable reusable procedure, create or update a workspace skill with skill_manage.",
  "Prefer memory for facts and decisions; prefer skills for repeatable procedures.",
  "IMPORTANT: Append to existing files; do not overwrite prior content.",
  `If nothing is worth saving, reply with ${SILENT_REPLY_TOKEN}.`,
].join(" ");

export const DEFAULT_POST_RUN_MEMORY_REVIEW_SYSTEM_PROMPT = [
  "Silent post-run memory review turn.",
  "This is internal housekeeping after every completed agent run.",
  "Do not do new user work. Decide whether durable memory should be written or a reusable skill should be evolved.",
  "Use session_search for cross-session precedent when helpful, and use skill_manage only for stable procedures.",
  `If no memory update is needed, usually ${SILENT_REPLY_TOKEN} is correct.`,
].join(" ");

export type PostRunMemoryReviewSettings = {
  enabled: boolean;
  minToolCalls: number;
  maxRecentMessages: number;
  allowInGroupChats: boolean;
  prompt: string;
  systemPrompt: string;
};

type TranscriptMessage = { role?: string; content?: unknown };

type ReviewDecision = {
  shouldRun: boolean;
  trigger: "agent_end" | "none";
  toolCallCount: number;
};

function ensureNoReplyHint(text: string): string {
  if (text.includes(SILENT_REPLY_TOKEN)) {
    return text;
  }
  return `${text}\n\nIf no user-visible reply is needed, start with ${SILENT_REPLY_TOKEN}.`;
}

function normalizeNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const int = Math.floor(value);
  return int >= 0 ? int : null;
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

function countToolResults(messages: TranscriptMessage[]): number {
  return messages.filter((message) => message.role === "toolResult").length;
}

export function decidePostRunMemoryReview(params: {
  transcriptMessages: TranscriptMessage[];
}): ReviewDecision {
  const currentTurn = extractCurrentTurnMessages(params.transcriptMessages);
  const toolCallCount = countToolResults(currentTurn);
  return {
    shouldRun: true,
    trigger: "agent_end",
    toolCallCount,
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
  const reviewSystemPrompt = [
    params.followupRun.run.extraSystemPrompt,
    settings.systemPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");
  const reviewSessionId = buildIsolatedInternalSessionId(
    params.followupRun.run.sessionId,
    "post-run-review",
    reviewRunId,
  );

  try {
    await runWithModelFallback({
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
          runId: reviewRunId,
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
              sessionId: reviewSessionId,
              sessionFile,
              prompt: resolveMemoryFlushPromptForRun({
                prompt: settings.prompt,
                cfg: params.cfg,
              }),
              extraSystemPrompt: reviewSystemPrompt,
            }),
        );
      },
    });
  } catch (err) {
    logVerbose(`post-run memory review failed: ${String(err)}`);
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
    });
  } catch (err) {
    logVerbose(`failed to persist post-run review ledger: ${String(err)}`);
  }
}
