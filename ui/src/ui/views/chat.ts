import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { extractTextCached, extractThinkingCached } from "../chat/message-extract.ts";
import { normalizeMessage } from "../chat/message-normalizer.ts";
import { icons } from "../icons.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";
import { detectTextDirection } from "../text-direction.ts";
import { formatToolDetail, resolveToolDisplay } from "../tool-display.ts";
import type { SessionsListResult } from "../types.ts";
import type { ChatAttachment, ChatQueueItem } from "../ui-types.ts";
import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../components/resizable-divider.ts";

export type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
};

export type FallbackIndicatorStatus = {
  phase?: "active" | "cleared";
  selected: string;
  active: string;
  previous?: string;
  reason?: string;
  attempts: string[];
  occurredAt: number;
};

export type ChatProps = {
  sessionKey: string;
  onSessionKeyChange: (next: string) => void;
  thinkingLevel: string | null;
  showThinking: boolean;
  loading: boolean;
  sending: boolean;
  canAbort?: boolean;
  compactionStatus?: CompactionIndicatorStatus | null;
  fallbackStatus?: FallbackIndicatorStatus | null;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  streamStartedAt: number | null;
  streamUpdatedAt?: number | null;
  assistantAvatarUrl?: string | null;
  draft: string;
  queue: ChatQueueItem[];
  connected: boolean;
  canSend: boolean;
  disabledReason: string | null;
  error: string | null;
  sessions: SessionsListResult | null;
  // Focus mode
  focusMode: boolean;
  // Sidebar state
  sidebarOpen?: boolean;
  sidebarContent?: string | null;
  sidebarError?: string | null;
  splitRatio?: number;
  assistantName: string;
  assistantAvatar: string | null;
  // Image attachments
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  // Scroll control
  showNewMessages?: boolean;
  onScrollToBottom?: () => void;
  // Event handlers
  onRefresh: () => void;
  onToggleFocusMode: () => void;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onQueueRemove: (id: string) => void;
  onNewSession: () => void;
  onOpenSidebar?: (content: string) => void;
  onCloseSidebar?: () => void;
  onSplitRatioChange?: (ratio: number) => void;
  onChatScroll?: (event: Event) => void;
};

type TimelineNode =
  | {
      kind: "text";
      key: string;
      timestamp: number;
      text: string;
      tone: "user" | "assistant" | "thinking" | "system";
      streaming?: boolean;
    }
  | {
      kind: "tool";
      key: string;
      timestamp: number;
      mergeKey: string;
      summary: string;
      detail: string;
      hasOutput: boolean;
      completed: boolean;
      running?: boolean;
    }
  | { kind: "divider"; key: string; label: string; timestamp: number };

const COMPACTION_TOAST_DURATION_MS = 5000;
const FALLBACK_TOAST_DURATION_MS = 8000;

function adjustTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function renderCompactionIndicator(status: CompactionIndicatorStatus | null | undefined) {
  if (!status) {
    return nothing;
  }

  // Show "compacting..." while active
  if (status.active) {
    return html`
      <div class="compaction-indicator compaction-indicator--active" role="status" aria-live="polite">
        ${icons.loader} Compacting context...
      </div>
    `;
  }

  // Show "compaction complete" briefly after completion
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      return html`
        <div class="compaction-indicator compaction-indicator--complete" role="status" aria-live="polite">
          ${icons.check} Context compacted
        </div>
      `;
    }
  }

  return nothing;
}

function renderFallbackIndicator(status: FallbackIndicatorStatus | null | undefined) {
  if (!status) {
    return nothing;
  }
  const phase = status.phase ?? "active";
  const elapsed = Date.now() - status.occurredAt;
  if (elapsed >= FALLBACK_TOAST_DURATION_MS) {
    return nothing;
  }
  const details = [
    `Selected: ${status.selected}`,
    phase === "cleared" ? `Active: ${status.selected}` : `Active: ${status.active}`,
    phase === "cleared" && status.previous ? `Previous fallback: ${status.previous}` : null,
    status.reason ? `Reason: ${status.reason}` : null,
    status.attempts.length > 0 ? `Attempts: ${status.attempts.slice(0, 3).join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const message =
    phase === "cleared"
      ? `Fallback cleared: ${status.selected}`
      : `Fallback active: ${status.active}`;
  const className =
    phase === "cleared"
      ? "compaction-indicator compaction-indicator--fallback-cleared"
      : "compaction-indicator compaction-indicator--fallback";
  const icon = phase === "cleared" ? icons.check : icons.brain;
  return html`
    <div
      class=${className}
      role="status"
      aria-live="polite"
      title=${details}
    >
      ${icon} ${message}
    </div>
  `;
}

function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function handlePaste(e: ClipboardEvent, props: ChatProps) {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) {
    return;
  }

  const imageItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      imageItems.push(item);
    }
  }

  if (imageItems.length === 0) {
    return;
  }

  e.preventDefault();

  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = reader.result as string;
      const newAttachment: ChatAttachment = {
        id: generateAttachmentId(),
        dataUrl,
        mimeType: file.type,
      };
      const current = props.attachments ?? [];
      props.onAttachmentsChange?.([...current, newAttachment]);
    });
    reader.readAsDataURL(file);
  }
}

function renderAttachmentPreview(props: ChatProps) {
  const attachments = props.attachments ?? [];
  if (attachments.length === 0) {
    return nothing;
  }

  return html`
    <div class="chat-attachments">
      ${attachments.map(
        (att) => html`
          <div class="chat-attachment">
            <img
              src=${att.dataUrl}
              alt="Attachment preview"
              class="chat-attachment__img"
            />
            <button
              class="chat-attachment__remove"
              type="button"
              aria-label="Remove attachment"
              @click=${() => {
                const next = (props.attachments ?? []).filter((a) => a.id !== att.id);
                props.onAttachmentsChange?.(next);
              }}
            >
              ${icons.x}
            </button>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderChat(props: ChatProps) {
  const canCompose = props.connected;
  const isBusy = props.sending || props.stream !== null;
  const canAbort = Boolean(props.canAbort && props.onAbort);

  const hasAttachments = (props.attachments?.length ?? 0) > 0;
  const composePlaceholder = props.connected
    ? hasAttachments
      ? "Add a message or paste more images..."
      : "Message (↩ to send, Shift+↩ for line breaks, paste images)"
    : "Connect to the gateway to start chatting…";

  const splitRatio = props.splitRatio ?? 0.6;
  const sidebarOpen = Boolean(props.sidebarOpen && props.onCloseSidebar);
  const timeline = buildTimelineNodes(props);
  const activeRunningToolKey = resolveActiveRunningToolKey(timeline);
  const thread = html`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${props.onChatScroll}
    >
      ${
        props.loading
          ? html`
              <div class="muted">Loading chat…</div>
            `
          : nothing
      }
      ${repeat(
        timeline,
        (item) => item.key,
        (item) => {
          if (item.kind === "divider") {
            return html`
              <div class="chat-divider" role="separator" data-ts=${String(item.timestamp)}>
                <span class="chat-divider__line"></span>
                <span class="chat-divider__label">${item.label}</span>
                <span class="chat-divider__line"></span>
              </div>
            `;
          }
          if (item.kind === "tool") {
            const running = item.running && item.key === activeRunningToolKey;
            return html`
              <details class="chat-flow-item chat-flow-item--tool ${running ? "is-running" : ""}">
                <summary>
                  <span class="chat-flow-tool-summary ${running ? "chat-flow-tool-summary--running" : "chat-flow-tool-summary--done"}">
                    ${running ? `Running ${item.summary}` : `Completed ${item.summary}`}
                  </span>
                  ${
                    running
                      ? html`
                          <span class="chat-flow-loader" aria-hidden="true"></span>
                        `
                      : nothing
                  }
                </summary>
                <pre class="chat-flow-tool-detail mono">${item.detail}</pre>
              </details>
            `;
          }
          if (item.tone === "user") {
            return html`
              <div class="chat-flow-item chat-flow-item--user-bubble">
                <div class="chat-flow-user-bubble">
                  ${unsafeHTML(toSanitizedMarkdownHtml(item.text))}
                </div>
              </div>
            `;
          }
          const className =
            item.tone === "thinking"
              ? "chat-flow-item chat-flow-item--thinking"
              : "chat-flow-item chat-flow-item--text";
          return html`
            <div class="${className} ${item.streaming ? "is-running" : ""}">
              ${unsafeHTML(toSanitizedMarkdownHtml(item.text))}
              ${
                item.streaming
                  ? html`
                      <span class="chat-flow-loader" aria-hidden="true"></span>
                    `
                  : nothing
              }
            </div>
          `;
        },
      )}
    </div>
  `;

  return html`
    <section class="card chat">
      ${props.disabledReason ? html`<div class="callout">${props.disabledReason}</div>` : nothing}

      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}

      ${
        props.focusMode
          ? html`
            <button
              class="chat-focus-exit"
              type="button"
              @click=${props.onToggleFocusMode}
              aria-label="Exit focus mode"
              title="Exit focus mode"
            >
              ${icons.x}
            </button>
          `
          : nothing
      }

      <div
        class="chat-split-container ${sidebarOpen ? "chat-split-container--open" : ""}"
      >
        <div
          class="chat-main"
          style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}"
        >
          ${thread}
        </div>

        ${
          sidebarOpen
            ? html`
              <resizable-divider
                .splitRatio=${splitRatio}
                @resize=${(e: CustomEvent) => props.onSplitRatioChange?.(e.detail.splitRatio)}
              ></resizable-divider>
              <div class="chat-sidebar">
                ${renderMarkdownSidebar({
                  content: props.sidebarContent ?? null,
                  error: props.sidebarError ?? null,
                  onClose: props.onCloseSidebar!,
                  onViewRawText: () => {
                    if (!props.sidebarContent || !props.onOpenSidebar) {
                      return;
                    }
                    props.onOpenSidebar(`\`\`\`\n${props.sidebarContent}\n\`\`\``);
                  },
                })}
              </div>
            `
            : nothing
        }
      </div>

      ${
        props.queue.length
          ? html`
            <div class="chat-queue" role="status" aria-live="polite">
              <div class="chat-queue__title">Queued (${props.queue.length})</div>
              <div class="chat-queue__list">
                ${props.queue.map(
                  (item) => html`
                    <div class="chat-queue__item">
                      <div class="chat-queue__text">
                        ${
                          item.text ||
                          (item.attachments?.length ? `Image (${item.attachments.length})` : "")
                        }
                      </div>
                      <button
                        class="btn chat-queue__remove"
                        type="button"
                        aria-label="Remove queued message"
                        @click=${() => props.onQueueRemove(item.id)}
                      >
                        ${icons.x}
                      </button>
                    </div>
                  `,
                )}
              </div>
            </div>
          `
          : nothing
      }

      ${renderFallbackIndicator(props.fallbackStatus)}
      ${renderCompactionIndicator(props.compactionStatus)}

      ${
        props.showNewMessages
          ? html`
            <button
              class="btn chat-new-messages"
              type="button"
              @click=${props.onScrollToBottom}
            >
              New messages ${icons.arrowDown}
            </button>
          `
          : nothing
      }

      <div class="chat-compose">
        ${renderAttachmentPreview(props)}
        <div class="chat-compose__row">
          <label class="field chat-compose__field">
            <span>Message</span>
            <textarea
              ${ref((el) => el && adjustTextareaHeight(el as HTMLTextAreaElement))}
              .value=${props.draft}
              dir=${detectTextDirection(props.draft)}
              ?disabled=${!props.connected}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key !== "Enter") {
                  return;
                }
                if (e.isComposing || e.keyCode === 229) {
                  return;
                }
                if (e.shiftKey) {
                  return;
                } // Allow Shift+Enter for line breaks
                if (!props.connected) {
                  return;
                }
                e.preventDefault();
                if (canCompose) {
                  props.onSend();
                }
              }}
              @input=${(e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                adjustTextareaHeight(target);
                props.onDraftChange(target.value);
              }}
              @paste=${(e: ClipboardEvent) => handlePaste(e, props)}
              placeholder=${composePlaceholder}
            ></textarea>
          </label>
          <div class="chat-compose__actions">
            <button
              class="btn"
              ?disabled=${!props.connected || (!canAbort && props.sending)}
              @click=${canAbort ? props.onAbort : props.onNewSession}
            >
              ${canAbort ? "Stop" : "New session"}
            </button>
            <button
              class="btn primary"
              ?disabled=${!props.connected}
              @click=${props.onSend}
            >
              ${isBusy ? "Queue" : "Send"}<kbd class="btn-kbd">↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

const CHAT_HISTORY_RENDER_LIMIT = 200;

function buildTimelineNodes(props: ChatProps): TimelineNode[] {
  const nodes: Array<{ node: TimelineNode; timestamp: number; order: number }> = [];
  let order = 0;
  const pushNode = (node: TimelineNode, timestamp: number) => {
    nodes.push({ node, timestamp, order: order++ });
  };
  const upsertToolNode = (toolNode: Extract<TimelineNode, { kind: "tool" }>, timestamp: number) => {
    const existing = nodes.find(
      (entry) => entry.node.kind === "tool" && entry.node.mergeKey === toolNode.mergeKey,
    );
    if (!existing) {
      pushNode(toolNode, timestamp);
      return;
    }
    const current = existing.node;
    const completed = current.completed || toolNode.completed;
    const summary =
      toolNode.summary.length > current.summary.length ? toolNode.summary : current.summary;
    existing.node = {
      ...current,
      summary,
      detail: mergeToolDetails(current.detail, toolNode.detail),
      hasOutput: current.hasOutput || toolNode.hasOutput,
      completed,
      running: !completed,
      timestamp: Math.min(current.timestamp, toolNode.timestamp),
    };
    existing.timestamp = Math.min(existing.timestamp, timestamp);
  };
  const seenMessageKeys = new Set<string>();
  const history = Array.isArray(props.messages) ? props.messages : [];
  const tools = Array.isArray(props.toolMessages) ? props.toolMessages : [];
  const historyStart = Math.max(0, history.length - CHAT_HISTORY_RENDER_LIMIT);
  const fallbackBaseTs = Date.now();
  if (historyStart > 0) {
    pushNode(
      {
        kind: "text",
        key: "chat:history:notice",
        timestamp: Number.MIN_SAFE_INTEGER,
        text: `Showing last ${CHAT_HISTORY_RENDER_LIMIT} messages (${historyStart} hidden).`,
        tone: "system",
      },
      Number.MIN_SAFE_INTEGER,
    );
  }
  for (let i = historyStart; i < history.length; i++) {
    const rawEntry = history[i];
    const { message: msg, envelope } = unwrapMessageEnvelope(rawEntry);
    const normalized = normalizeMessage(msg);
    const timestamp = resolveMessageTimestamp(msg, envelope, fallbackBaseTs + i);
    const marker =
      (envelope.__openclaw as Record<string, unknown> | undefined) ??
      (msg.__openclaw as Record<string, unknown> | undefined);
    if (marker && marker.kind === "compaction") {
      pushNode(
        {
          kind: "divider",
          key:
            typeof marker.id === "string"
              ? `divider:compaction:${marker.id}`
              : `divider:compaction:${timestamp}:${i}`,
          label: "Compaction",
          timestamp,
        },
        timestamp,
      );
      continue;
    }

    // Filter out system notification messages (e.g., "Exec completed", background process updates)
    // These are internal OpenClaw events that shouldn't be shown to users
    if (normalized.role.toLowerCase() === "system") {
      const textContent = normalized.content
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      // Skip system messages that look like internal notifications
      if (
        /^System:\s*\[.*\]\s*Exec completed/i.test(textContent) ||
        /^\[.*\]\s*Exec completed/i.test(textContent) ||
        textContent.startsWith("Exec completed")
      ) {
        continue;
      }
    }

    const key = messageKey(rawEntry, i);
    seenMessageKeys.add(key);
    const role = normalized.role.toLowerCase();
    const thinking = extractThinkingCached(msg);
    if (thinking) {
      pushNode(
        {
          kind: "text",
          key: `thinking:${key}`,
          timestamp,
          text: thinking,
          tone: "thinking",
        },
        timestamp,
      );
    }
    const toolNode = toToolNode(msg, key, timestamp);
    if (toolNode) {
      upsertToolNode(toolNode, timestamp);
      continue;
    }
    const text = extractTextCached(msg);
    if (!text?.trim()) {
      continue;
    }
    pushNode(
      {
        kind: "text",
        key: `text:${key}`,
        timestamp,
        text,
        tone: role === "user" ? "user" : role === "assistant" ? "assistant" : "system",
      },
      timestamp,
    );
  }

  for (let i = 0; i < tools.length; i++) {
    const rawEntry = tools[i];
    const { message: msg, envelope } = unwrapMessageEnvelope(rawEntry);
    const key = messageKey(rawEntry, i + history.length);
    if (seenMessageKeys.has(key)) {
      continue;
    }
    const timestamp = resolveMessageTimestamp(msg, envelope, fallbackBaseTs + history.length + i);
    const toolNode = toToolNode(msg, key, timestamp);
    if (!toolNode) {
      continue;
    }
    upsertToolNode(toolNode, timestamp);
  }

  if (props.stream !== null) {
    const key = `stream:${props.sessionKey}:${props.streamStartedAt ?? "live"}:text`;
    const streamTimestamp =
      props.streamUpdatedAt ??
      props.streamStartedAt ??
      fallbackBaseTs + history.length + tools.length;
    pushNode(
      {
        kind: "text",
        key,
        timestamp: streamTimestamp,
        text: props.stream.trim().length > 0 ? props.stream : "Thinking…",
        tone: "assistant",
        streaming: true,
      },
      streamTimestamp,
    );
  }

  return nodes
    .toSorted((a, b) =>
      a.timestamp === b.timestamp ? a.order - b.order : a.timestamp - b.timestamp,
    )
    .map((entry) => entry.node);
}

function resolveActiveRunningToolKey(nodes: TimelineNode[]): string | null {
  const running = nodes.filter(
    (node): node is Extract<TimelineNode, { kind: "tool" }> =>
      node.kind === "tool" && node.running === true,
  );
  if (running.length === 0) {
    return null;
  }
  return running[running.length - 1].key;
}

function toToolNode(message: unknown, key: string, timestamp: number): TimelineNode | null {
  const m = message as Record<string, unknown>;
  const content = Array.isArray(m.content) ? (m.content as Array<Record<string, unknown>>) : [];
  const role = typeof m.role === "string" ? m.role.toLowerCase() : "";
  const hasToolId = typeof m.toolCallId === "string" || typeof m.tool_call_id === "string";
  const hasToolRole =
    role === "toolresult" || role === "tool_result" || role === "tool" || role === "function";
  const callItem = content.find((entry) => {
    const type = (typeof entry.type === "string" ? entry.type : "").toLowerCase();
    return type === "toolcall" || type === "tool_call" || type === "tooluse" || type === "tool_use";
  });
  const resultItem = content.find((entry) => {
    const type = (typeof entry.type === "string" ? entry.type : "").toLowerCase();
    return type === "toolresult" || type === "tool_result";
  });
  if (!hasToolId && !hasToolRole && !callItem && !resultItem) {
    return null;
  }

  const name =
    (typeof callItem?.name === "string" ? callItem.name : undefined) ??
    (typeof resultItem?.name === "string" ? resultItem.name : undefined) ??
    (typeof m.toolName === "string" ? m.toolName : undefined) ??
    (typeof m.tool_name === "string" ? m.tool_name : undefined) ??
    "tool";
  const args = callItem?.arguments ?? callItem?.args;
  const output =
    extractToolResultText(resultItem) ??
    extractTextCached(message) ??
    (typeof m.text === "string" ? m.text : "");
  const isReadTool = name.toLowerCase() === "read";
  const hasResultSignal =
    Boolean(resultItem) ||
    role === "toolresult" ||
    role === "tool_result" ||
    role === "tool" ||
    role === "function";
  const hasOutput = !isReadTool && output.trim().length > 0;
  const completed = hasResultSignal || hasOutput;
  const running = !completed;
  const display = resolveToolDisplay({ name, args });
  const detail = formatToolDetail(display);
  const summary = detail ? `${display.name || name} ${detail}` : display.name || name;
  const rawToolCallId =
    (typeof m.toolCallId === "string" ? m.toolCallId : undefined) ??
    (typeof m.tool_call_id === "string" ? m.tool_call_id : undefined) ??
    (typeof callItem?.id === "string" ? callItem.id : undefined);
  const mergeKey = rawToolCallId
    ? `tool:${rawToolCallId}`
    : `sig:${display.name || name}:${safeJson(args ?? null)}`;
  const detailText = [
    `Tool: ${display.label}`,
    detail ? `Detail: ${detail}` : null,
    args != null ? `Args:\n${safeJson(args)}` : null,
    hasOutput ? `Output:\n${output.trim()}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  return {
    kind: "tool",
    key: `tool-node:${key}`,
    timestamp,
    mergeKey,
    summary,
    hasOutput,
    completed,
    detail: detailText,
    running,
  };
}

function extractToolResultText(item: Record<string, unknown> | undefined): string | null {
  if (!item) {
    return null;
  }
  if (typeof item.text === "string") {
    return item.text;
  }
  if (typeof item.content === "string") {
    return item.content;
  }
  return null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) {
      return ms;
    }
  }
  return null;
}

function unwrapMessageEnvelope(entry: unknown): {
  message: Record<string, unknown>;
  envelope: Record<string, unknown>;
} {
  const envelope = (entry ?? {}) as Record<string, unknown>;
  const nested = envelope.message;
  if (nested && typeof nested === "object") {
    return { message: nested as Record<string, unknown>, envelope };
  }
  return { message: envelope, envelope };
}

function resolveMessageTimestamp(
  message: Record<string, unknown>,
  envelope: Record<string, unknown>,
  fallback: number,
): number {
  return parseTimestamp(message.timestamp) ?? parseTimestamp(envelope.timestamp) ?? fallback;
}

function parseToolDetailSections(detail: string): Record<string, string> {
  const out: Record<string, string> = {};
  const chunks = detail
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const match = /^([A-Za-z]+):\s*([\s\S]*)$/.exec(chunk);
    if (!match) {
      continue;
    }
    const key = match[1];
    const value = match[2]?.trim() ?? "";
    if (!value) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function mergeToolDetails(current: string, incoming: string): string {
  const a = parseToolDetailSections(current);
  const b = parseToolDetailSections(incoming);
  const merged: string[] = [];
  const tool = b.Tool ?? a.Tool;
  const detail = a.Detail ?? b.Detail;
  const args = a.Args ?? b.Args;
  const output = b.Output ?? a.Output;
  if (tool) {
    merged.push(`Tool: ${tool}`);
  }
  if (detail) {
    merged.push(`Detail: ${detail}`);
  }
  if (args) {
    merged.push(`Args:\n${args}`);
  }
  if (output) {
    merged.push(`Output:\n${output}`);
  }
  return merged.join("\n\n");
}

function messageKey(message: unknown, index: number): string {
  const m = message as Record<string, unknown>;
  const toolCallId = typeof m.toolCallId === "string" ? m.toolCallId : "";
  if (toolCallId) {
    return `tool:${toolCallId}`;
  }
  const id = typeof m.id === "string" ? m.id : "";
  if (id) {
    return `msg:${id}`;
  }
  const messageId = typeof m.messageId === "string" ? m.messageId : "";
  if (messageId) {
    return `msg:${messageId}`;
  }
  const timestamp = typeof m.timestamp === "number" ? m.timestamp : null;
  const role = typeof m.role === "string" ? m.role : "unknown";
  if (timestamp != null) {
    return `msg:${role}:${timestamp}:${index}`;
  }
  return `msg:${role}:${index}`;
}
