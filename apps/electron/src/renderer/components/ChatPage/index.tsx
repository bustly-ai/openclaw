import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  File,
  Folder,
  Image,
  Paperclip,
  Stop,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { listWorkspaceSummaries } from "../../lib/bustly-supabase";
import { GatewayBrowserClient, type GatewayEventFrame } from "../../lib/gateway-client";
import {
  deriveScenarioLabel,
  resolveSessionIconComponent,
} from "../../lib/session-icons";
import { buildBustlyWorkspaceMainSessionKey } from "../../../shared/bustly-agent";
import { extractText, extractThinking } from "../../lib/chat-extract";
import Skeleton from "../ui/Skeleton";
import PortalTooltip from "../ui/PortalTooltip";
import ChatModelPicker from "./ChatModelPicker";
import { ChatTimeline } from "./ChatTimeline";
import {
  buildInputArtifactsMessage,
  inferInputArtifactKind,
  type ChatInputArtifact,
  type InputArtifactKind,
} from "./input-artifacts";
import { collapseProcessedTurn, collapseStreamingEvents, resolveToolDisplay, formatToolDetail } from "./utils";
import type { TimelineArtifact, TimelineNode } from "./types";
import { useAppState } from "../../providers/AppStateProvider";

type ChatRole = "user" | "assistant" | "thinking" | "system";

type Attachment = {
  id: string;
  dataUrl: string;
  mimeType: string;
  name: string;
};

type ContextPath = {
  id: string;
  path: string;
  name: string;
  kind: InputArtifactKind;
  imageUrl?: string;
};

type TextItem = {
  kind: "text";
  id: string;
  sortSeq: number;
  timestamp: number;
  role: ChatRole;
  text: string;
  artifacts?: TimelineArtifact[];
  runId?: string;
  streaming?: boolean;
  final?: boolean;
};

type ToolStatus = "running" | "completed" | "error";

type ToolItem = {
  kind: "tool";
  id: string;
  toolCallId: string;
  runId?: string;
  sortSeq: number;
  timestamp: number;
  name: string;
  args: unknown;
  output?: string;
  status: ToolStatus;
};

type ErrorItem = {
  kind: "error";
  id: string;
  sortSeq: number;
  timestamp: number;
  reason: string;
  description: string;
  runId?: string;
};

type TimelineItem = TextItem | ToolItem | ErrorItem;

type SessionUsageSummary = {
  totalTokens: number | null;
  contextTokens: number | null;
  remainingTokens: number | null;
};

type RunTerminalState = "final" | "aborted" | "error";
type ConnectionNoticeTone = "warning" | "error";
type ReconnectStatus = {
  runId: string;
};

type RetryPayload = {
  draft: string;
  attachments: Attachment[];
  contextPaths: ContextPath[];
};

const SILENT_REPLY_TOKEN = "NO_REPLY";

function isSilentReplyText(text: string | undefined, token: string = SILENT_REPLY_TOKEN): boolean {
  if (!text) {
    return false;
  }
  const trimmed = text.trim().toUpperCase();
  if (!trimmed) {
    return false;
  }
  const normalizedToken = token.toUpperCase();
  if (trimmed === normalizedToken) {
    return true;
  }
  return trimmed.startsWith(`${normalizedToken} `) || trimmed.endsWith(` ${normalizedToken}`);
}

type StreamSegmentState = {
  assistant: number;
  assistantClosed: boolean;
  thinking: number;
  thinkingOpen: boolean;
};

type SessionViewState = {
  loading: boolean;
  sending: boolean;
  timeline: TimelineItem[];
  draft: string;
  attachments: Attachment[];
  contextPaths: ContextPath[];
  activeRunId: string | null;
  compactingRunId: string | null;
  reconnectStatus: ReconnectStatus | null;
  sessionUsage: SessionUsageSummary;
};

type SessionRuntimeState = {
  view: SessionViewState;
  seqCounter: number;
  toolTimers: Map<string, number>;
  runSeqBase: Map<string, number>;
  settledRunIds: Set<string>;
  discardedRunIds: Set<string>;
  retryPayloads: Map<string, RetryPayload>;
  streamSegments: Map<string, StreamSegmentState>;
  historyLoaded: boolean;
  usageLoaded: boolean;
};

const TOOL_RUNNING_MIN_VISIBLE_MS = 600;
const SIDEBAR_TASKS_REFRESH_EVENT = "openclaw:sidebar-refresh-tasks";
const SIDEBAR_TASK_RUN_STATE_EVENT = "openclaw:sidebar-task-run-state";
const CHAT_MODEL_LEVEL_STORAGE_KEY = "bustly.chat.model-level.v1";
const INITIAL_SESSION_USAGE: SessionUsageSummary = {
  totalTokens: null,
  contextTokens: null,
  remainingTokens: null,
};

const CHAT_MODEL_LEVELS = [
  {
    id: "standard",
    modelRef: "bustly/chat.standard",
    label: "Bustly Standard",
    description: "Fast & efficient for daily tasks.",
  },
  {
    id: "advanced",
    modelRef: "bustly/chat.advanced",
    label: "Bustly Advanced",
    description: "Balanced performance for complex reasoning.",
  },
  {
    id: "ultra",
    modelRef: "bustly/chat.ultra",
    label: "Bustly Ultra",
    description: "Frontier intelligence for critical challenges.",
  },
] as const;
const PREVIEW_ZOOM_STEPS = [0.5, 0.67, 0.8, 1] as const;
const PREVIEW_ZOOM_WHEEL_THRESHOLD = 45;
const PREVIEW_ZOOM_STEP_THROTTLE_MS = 45;

type ChatModelLevelId = (typeof CHAT_MODEL_LEVELS)[number]["id"];

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function notifySidebarTasksRefresh() {
  window.dispatchEvent(new Event(SIDEBAR_TASKS_REFRESH_EVENT));
}

function isSessionViewRunning(view: SessionViewState): boolean {
  return Boolean(view.sending || view.activeRunId || view.compactingRunId || view.reconnectStatus);
}

function notifySidebarTaskRunState(sessionKey: string, running: boolean) {
  window.dispatchEvent(
    new CustomEvent(SIDEBAR_TASK_RUN_STATE_EVENT, {
      detail: { sessionKey, running },
    }),
  );
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function sessionAccentClasses(sessionKey: string) {
  const palette = [
    "bg-[#E8F1FF] text-[#2E5AAC]",
    "bg-[#EFF7EA] text-[#3E7D3C]",
    "bg-[#FFF1E6] text-[#A55B1F]",
    "bg-[#F4ECFF] text-[#6B46A6]",
    "bg-[#FDECEF] text-[#B43C59]",
  ] as const;
  return palette[hashString(sessionKey) % palette.length] ?? palette[0];
}

function normalizeTextDelta(current: string, text?: string, delta?: string): string {
  if (typeof text === "string") {
    if (!current || text.length >= current.length) {
      return text;
    }
    return current;
  }
  if (typeof delta === "string") {
    return `${current}${delta}`;
  }
  return current;
}

function normalizeComparableMessageText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function resolvePreviewMinZoom(viewportWidth: number, viewportHeight: number, imageWidth: number, imageHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return PREVIEW_ZOOM_STEPS[0];
  }
  const fullWidthHeight = viewportWidth * (imageHeight / imageWidth);
  if (fullWidthHeight <= 0) {
    return PREVIEW_ZOOM_STEPS[0];
  }
  return Math.min(1, viewportHeight / fullWidthHeight);
}

function resolvePreviewZoomChoices(minZoom: number): number[] {
  return Array.from(new Set([Number(minZoom.toFixed(3)), ...PREVIEW_ZOOM_STEPS.filter((step) => step > minZoom + 0.001)])).toSorted((a, b) => a - b);
}

function formatTokenCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "?";
  }
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 100) / 10}k`;
  }
  return String(Math.round(value));
}

function resolveStateUpdate<T>(action: SetStateAction<T>, prev: T): T {
  return typeof action === "function" ? (action as (current: T) => T)(prev) : action;
}

function createInitialSessionViewState(): SessionViewState {
  return {
    loading: true,
    sending: false,
    timeline: [],
    draft: "",
    attachments: [],
    contextPaths: [],
    activeRunId: null,
    compactingRunId: null,
    reconnectStatus: null,
    sessionUsage: { ...INITIAL_SESSION_USAGE },
  };
}

function createSessionRuntimeState(): SessionRuntimeState {
  return {
    view: createInitialSessionViewState(),
    seqCounter: 1_000_000_000,
    toolTimers: new Map(),
    runSeqBase: new Map(),
    settledRunIds: new Set(),
    discardedRunIds: new Set(),
    retryPayloads: new Map(),
    streamSegments: new Map(),
    historyLoaded: false,
    usageLoaded: false,
  };
}

function resolveChatTerminalState(payload: {
  state?: string;
}): RunTerminalState | null {
  if (payload.state === "final" || payload.state === "aborted" || payload.state === "error") {
    return payload.state;
  }
  return null;
}

function resolveAgentTerminalState(payload: {
  stream?: string;
  data?: Record<string, unknown>;
}): RunTerminalState | null {
  if (payload.stream !== "lifecycle") {
    return null;
  }
  if (payload.data?.phase !== "end") {
    return null;
  }
  return payload.data?.aborted === true ? "aborted" : "final";
}

function describeExecutionError(reason: string): string {
  const normalized = reason.trim().toLowerCase();
  if (normalized.includes("connection")) {
    return "The gateway connection was interrupted before execution could complete. Retry the request after the connection recovers.";
  }
  if (normalized.includes("rate limit") || normalized.includes("429")) {
    return "The upstream model temporarily rejected the request due to rate limiting. Retry in a moment or switch to a different model tier.";
  }
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("401") ||
    normalized.includes("forbidden") ||
    normalized.includes("403")
  ) {
    return "The current provider credentials were rejected. Refresh the provider auth and retry the request.";
  }
  return "Execution stopped before the agent could finish this run. Retry the request or check the gateway connection and model availability.";
}

function extractAgentErrorReason(payload: {
  stream?: string;
  data?: Record<string, unknown>;
}): string {
  const data = payload.data ?? {};
  const errorMessage =
    typeof data.error === "string"
      ? data.error
      : typeof data.message === "string"
        ? data.message
        : typeof data.reason === "string"
          ? data.reason
          : typeof data.stopReason === "string"
            ? data.stopReason
            : "";
  if (errorMessage.trim()) {
    return errorMessage.trim();
  }
  if (payload.stream === "error") {
    return "Execution error.";
  }
  return "Connection error.";
}

function extractToolText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.text === "string") {
    return rec.text;
  }
  if (Array.isArray(rec.content)) {
    const parts = rec.content
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const item = entry as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return null;
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) {
      return parts.join("\n");
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (typeof value === "symbol") {
      return value.description ? `Symbol(${value.description})` : "Symbol()";
    }
    if (typeof value === "function") {
      return "[function]";
    }
    return Object.prototype.toString.call(value);
  }
}

function parseDataUrl(dataUrl: string): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
}

function looksLikeImagePath(pathOrName: string | undefined): boolean {
  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|tiff|webp)$/i.test(pathOrName ?? "");
}

function parseTransferredFilePaths(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split("\0")
    .join("\n")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("file://")) {
        try {
          return decodeURIComponent(new URL(entry).pathname);
        } catch {
          return entry;
        }
      }
      return entry;
    })
    .filter((entry) => entry.startsWith("/"));
}

function extractNativeTransferPaths(dataTransfer?: DataTransfer | null): string[] {
  if (!dataTransfer) {
    return [];
  }
  const candidates = [
    dataTransfer.getData("text/uri-list"),
    dataTransfer.getData("text/plain"),
  ];
  const paths = new Set<string>();
  for (const candidate of candidates) {
    for (const path of parseTransferredFilePaths(candidate)) {
      paths.add(path);
    }
  }
  return [...paths];
}

async function resolvePastedSelection(params: {
  file?: File;
  entryPath?: string;
  entryName?: string;
  transferPaths?: string[];
  fallbackKind: "file" | "directory";
}): Promise<{ path: string; kind: "file" | "directory" }> {
  if (typeof window.electronAPI?.resolvePastedPath !== "function") {
    return { path: params.entryPath?.trim() ?? "", kind: params.fallbackKind };
  }
  try {
    const resolved = await window.electronAPI.resolvePastedPath(params);
    return {
      path: resolved?.path?.trim() ?? params.entryPath?.trim() ?? "",
      kind: resolved?.kind === "directory" || resolved?.kind === "file" ? resolved.kind : params.fallbackKind,
    };
  } catch {
    return { path: params.entryPath?.trim() ?? "", kind: params.fallbackKind };
  }
}

function compareTimeline(a: TimelineItem, b: TimelineItem): number {
  if (a.sortSeq !== b.sortSeq) {
    return a.sortSeq - b.sortSeq;
  }
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  return a.id.localeCompare(b.id);
}

function readContentText(message: unknown): string | null {
  const text = extractText(message);
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  return trimmed ? text : null;
}

function readThinkingText(message: unknown): string | null {
  const text = extractThinking(message);
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  return trimmed ? text : null;
}

function isCommandMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  return (message as Record<string, unknown>).command === true;
}

function readMessageRole(message: unknown): ChatRole {
  if (!message || typeof message !== "object") {
    return "assistant";
  }
  const roleValue = (message as Record<string, unknown>).role;
  const role = typeof roleValue === "string" ? roleValue.toLowerCase() : "";
  if (role === "user") {
    return "user";
  }
  if (role === "system") {
    return "system";
  }
  return "assistant";
}

function isCompactionSystemMessage(message: unknown, text: string | null): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const rec = message as Record<string, unknown>;
  const role = typeof rec.role === "string" ? rec.role.toLowerCase() : "";
  if (role !== "system") {
    return false;
  }
  const meta =
    rec.__openclaw && typeof rec.__openclaw === "object"
      ? (rec.__openclaw as Record<string, unknown>)
      : null;
  const kind = typeof meta?.kind === "string" ? meta.kind.toLowerCase() : "";
  if (kind === "compaction") {
    return true;
  }
  return text?.trim() === "Compaction";
}

function parseToolBlocks(message: unknown): Array<{ toolCallId: string; name: string; args?: unknown; output?: string }> {
  if (!message || typeof message !== "object") {
    return [];
  }
  const rec = message as Record<string, unknown>;
  const role = typeof rec.role === "string" ? rec.role.toLowerCase() : "";

  // Handle standalone tool/toolResult history messages.
  if (role === "toolresult" || role === "tool_result") {
    const toolCallId =
      typeof rec.toolCallId === "string"
        ? rec.toolCallId
        : typeof rec.id === "string"
          ? rec.id
          : "";
    if (!toolCallId) {
      return [];
    }
    return [
      {
        toolCallId,
        name: typeof rec.toolName === "string" ? rec.toolName : "tool",
        output: extractToolText(rec.content ?? rec.text ?? rec.output ?? rec),
      },
    ];
  }
  if (role === "toolcall" || role === "tool_call" || role === "tool") {
    const toolCallId = typeof rec.id === "string" ? rec.id : "";
    if (!toolCallId) {
      return [];
    }
    return [
      {
        toolCallId,
        name: typeof rec.name === "string" ? rec.name : "tool",
        args: rec.arguments ?? rec.args ?? {},
      },
    ];
  }

  const content = Array.isArray(rec.content) ? rec.content : [];
  const calls = new Map<string, { toolCallId: string; name: string; args: unknown; output?: string }>();
  for (const raw of content) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const item = raw as Record<string, unknown>;
    const type = typeof item.type === "string" ? item.type.toLowerCase() : "";
    if (type === "toolcall") {
      const toolCallId = typeof item.id === "string" ? item.id : "";
      if (!toolCallId) {
        continue;
      }
      const name = typeof item.name === "string" ? item.name : "tool";
      calls.set(toolCallId, {
        toolCallId,
        name,
        args: item.arguments ?? item.args ?? {},
      });
      continue;
    }
    if (type === "toolresult" || type === "tool_result") {
      const toolCallId =
        typeof item.toolCallId === "string"
          ? item.toolCallId
          : typeof item.id === "string"
            ? item.id
            : "";
      if (!toolCallId) {
        continue;
      }
      const existing = calls.get(toolCallId);
      const output = extractToolText(item.text ?? item.content ?? item.output ?? item);
      calls.set(toolCallId, {
        toolCallId,
        name: typeof item.name === "string" ? item.name : existing?.name ?? "tool",
        args: existing?.args,
        output,
      });
    }
  }
  return [...calls.values()];
}

function InputArtifactCard({
  kind,
  title,
  subtitle,
  imageUrl,
  onPreview,
  onRemove,
}: {
  kind: InputArtifactKind;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  onPreview?: () => void;
  onRemove: () => void;
}) {
  const Icon = kind === "directory" ? Folder : kind === "image" ? Image : File;

  return (
    <div
      className="group/input flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100 py-1 pr-1 pl-2 text-xs font-medium text-text-main"
      title={subtitle ?? title}
    >
      {imageUrl ? (
        <button type="button" className="h-5 w-5 shrink-0 overflow-hidden rounded-md border border-gray-200" onClick={onPreview}>
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-text-sub">
          <Icon size={16} weight="bold" />
        </div>
      )}
      <div className="min-w-0 max-w-[220px] truncate">{title}</div>
      <button
        type="button"
        className="rounded text-text-sub transition-colors hover:bg-gray-200 hover:text-text-main"
        onClick={onRemove}
        aria-label={`Remove ${title}`}
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}

const COMPOSER_PLACEHOLDERS = [
  "Compare this month's revenue with last year...",
  "Identify my most loyal customers...",
  "Which products are low on stock?",
  "Summarize the latest campaign performance...",
  "Draft a marketing email for the new collection...",
];

function PlaceholderTicker({ items }: { items: string[] }) {
  const list = useMemo(() => {
    const trimmed = items.map((item) => item.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      return [];
    }
    return [...trimmed, trimmed[0]];
  }, [items]);
  const [index, setIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);

  useEffect(() => {
    if (list.length <= 1) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setIndex((value) => value + 1);
      setTransitionEnabled(true);
    }, 2600);
    return () => {
      window.clearInterval(timer);
    };
  }, [list.length]);

  useEffect(() => {
    if (list.length <= 1 || index !== list.length - 1) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setTransitionEnabled(false);
      setIndex(0);
    }, 520);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [index, list.length]);

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute top-1 left-1 right-14 h-6 overflow-hidden">
      <div
        className="flex flex-col"
        style={{
          transform: `translateY(-${index * 24}px)`,
          transition: transitionEnabled ? "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      >
        {list.map((item, itemIndex) => (
          <div key={`${itemIndex}-${item}`} className="flex h-6 items-center truncate text-base font-normal leading-6 text-text-sub/40">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { ensureGatewayReady, gatewayReady } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [contextPaths, setContextPaths] = useState<ContextPath[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<{
    message: string;
    tone: ConnectionNoticeTone;
  } | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [compactingRunId, setCompactingRunId] = useState<string | null>(null);
  const [reconnectStatus, setReconnectStatus] = useState<ReconnectStatus | null>(null);
  const [sessionUsage, setSessionUsage] = useState<SessionUsageSummary>({ ...INITIAL_SESSION_USAGE });
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [composerAreaHeight, setComposerAreaHeight] = useState(176);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(0.67);
  const [previewMinZoom, setPreviewMinZoom] = useState(0.67);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [subscriptionActionText, setSubscriptionActionText] = useState("Upgrade");
  const [modelLevel, setModelLevel] = useState<ChatModelLevelId>(() => {
    const stored = window.localStorage.getItem(CHAT_MODEL_LEVEL_STORAGE_KEY);
    if (stored === "standard" || stored === "advanced" || stored === "ultra") {
      return stored;
    }
    // Backward-compatible migration for older local values.
    if (stored === "lite" || stored === "auto") {
      return "standard";
    }
    if (stored === "pro") {
      return "advanced";
    }
    if (stored === "max") {
      return "ultra";
    }
    return "standard";
  });

  const clientRef = useRef<GatewayBrowserClient | null>(null);
  const sessionRuntimesRef = useRef<Map<string, SessionRuntimeState>>(new Map());
  const currentSessionKeyRef = useRef("");
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewWheelDeltaRef = useRef(0);
  const previewWheelLastStepAtRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerAreaRef = useRef<HTMLDivElement | null>(null);
  const composerIsComposingRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const bootstrapWakeAttemptedSessionsRef = useRef<Set<string>>(new Set());
  const [currentScenarioIconId, setCurrentScenarioIconId] = useState<string | null>(null);
  const lastAppliedPromptRef = useRef<string | null>(null);
  const lastAppliedContextRef = useRef<string | null>(null);
  const pendingPromptFocusRef = useRef(false);
  const currentSessionKey = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("session") ?? buildBustlyWorkspaceMainSessionKey(activeWorkspaceId);
  }, [activeWorkspaceId, location.search]);
  const currentScenarioLabel = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return deriveScenarioLabel(currentSessionKey, searchParams.get("label"));
  }, [currentSessionKey, location.search]);
  const canSendMessage =
    connected && !subscriptionExpired && !sending && (draft.trim() || attachments.length > 0 || contextPaths.length > 0);
  const showPlaceholderTicker =
    connected && !subscriptionExpired && !draft && attachments.length === 0 && contextPaths.length === 0;

  const getSessionRuntime = useCallback((sessionKey: string) => {
    const normalized = sessionKey.trim();
    let runtime = sessionRuntimesRef.current.get(normalized);
    if (!runtime) {
      runtime = createSessionRuntimeState();
      sessionRuntimesRef.current.set(normalized, runtime);
    }
    return runtime;
  }, []);

  const applyVisibleSessionView = useCallback((view: SessionViewState) => {
    setLoading(view.loading);
    setSending(view.sending);
    setTimeline(view.timeline);
    setDraft(view.draft);
    setAttachments(view.attachments);
    setContextPaths(view.contextPaths);
    setActiveRunId(view.activeRunId);
    setCompactingRunId(view.compactingRunId);
    setReconnectStatus(view.reconnectStatus);
    setSessionUsage(view.sessionUsage);
  }, []);

  const replaceSessionView = useCallback((sessionKey: string, nextView: SessionViewState) => {
    const runtime = getSessionRuntime(sessionKey);
    const wasRunning = isSessionViewRunning(runtime.view);
    const isRunning = isSessionViewRunning(nextView);
    runtime.view = nextView;
    if (wasRunning !== isRunning) {
      notifySidebarTaskRunState(sessionKey, isRunning);
    }
    if (currentSessionKeyRef.current === sessionKey) {
      applyVisibleSessionView(nextView);
    }
    return runtime;
  }, [applyVisibleSessionView, getSessionRuntime]);

  const updateSessionView = useCallback((
    sessionKey: string,
    updater: (view: SessionViewState) => SessionViewState,
  ) => {
    const runtime = getSessionRuntime(sessionKey);
    return replaceSessionView(sessionKey, updater(runtime.view));
  }, [getSessionRuntime, replaceSessionView]);

  const setSessionLoading = useCallback((sessionKey: string, action: SetStateAction<boolean>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, loading: resolveStateUpdate(action, view.loading) }));
  }, [updateSessionView]);

  const setSessionSending = useCallback((sessionKey: string, action: SetStateAction<boolean>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, sending: resolveStateUpdate(action, view.sending) }));
  }, [updateSessionView]);

  const setSessionTimeline = useCallback((sessionKey: string, action: SetStateAction<TimelineItem[]>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, timeline: resolveStateUpdate(action, view.timeline) }));
  }, [updateSessionView]);

  const setSessionDraft = useCallback((sessionKey: string, action: SetStateAction<string>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, draft: resolveStateUpdate(action, view.draft) }));
  }, [updateSessionView]);

  const setSessionAttachments = useCallback((sessionKey: string, action: SetStateAction<Attachment[]>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, attachments: resolveStateUpdate(action, view.attachments) }));
  }, [updateSessionView]);

  const setSessionContextPaths = useCallback((sessionKey: string, action: SetStateAction<ContextPath[]>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, contextPaths: resolveStateUpdate(action, view.contextPaths) }));
  }, [updateSessionView]);

  const setSessionActiveRunId = useCallback((sessionKey: string, action: SetStateAction<string | null>) => {
    updateSessionView(sessionKey, (view) => ({ ...view, activeRunId: resolveStateUpdate(action, view.activeRunId) }));
  }, [updateSessionView]);

  const setSessionCompactingRunId = useCallback((sessionKey: string, action: SetStateAction<string | null>) => {
    updateSessionView(sessionKey, (view) => ({
      ...view,
      compactingRunId: resolveStateUpdate(action, view.compactingRunId),
    }));
  }, [updateSessionView]);

  const setSessionReconnectStatus = useCallback((sessionKey: string, action: SetStateAction<ReconnectStatus | null>) => {
    updateSessionView(sessionKey, (view) => ({
      ...view,
      reconnectStatus: resolveStateUpdate(action, view.reconnectStatus),
    }));
  }, [updateSessionView]);

  const setSessionUsageState = useCallback((sessionKey: string, action: SetStateAction<SessionUsageSummary>) => {
    updateSessionView(sessionKey, (view) => ({
      ...view,
      sessionUsage: resolveStateUpdate(action, view.sessionUsage),
    }));
  }, [updateSessionView]);
  useEffect(() => {
    currentSessionKeyRef.current = currentSessionKey;
    const runtime = getSessionRuntime(currentSessionKey);
    setCurrentScenarioIconId(null);
    applyVisibleSessionView(runtime.view);
  }, [applyVisibleSessionView, currentSessionKey, getSessionRuntime]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    setCurrentScenarioIconId(searchParams.get("icon"));
  }, [location.search]);
  useEffect(() => {
    setPreviewZoom(0.67);
    setPreviewMinZoom(0.67);
    previewWheelDeltaRef.current = 0;
    previewWheelLastStepAtRef.current = 0;
  }, [previewImage]);
  useEffect(() => {
    if (!previewImage) {
      return undefined;
    }
    const updatePreviewBounds = () => {
      const viewport = previewViewportRef.current;
      const image = previewImageRef.current;
      if (!viewport || !image || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return;
      }
      const minZoom = resolvePreviewMinZoom(
        viewport.clientWidth,
        viewport.clientHeight,
        image.naturalWidth,
        image.naturalHeight,
      );
      setPreviewMinZoom(minZoom);
      setPreviewZoom((value) => Math.max(minZoom, Math.min(1, value)));
    };
    updatePreviewBounds();
    window.addEventListener("resize", updatePreviewBounds);
    return () => {
      window.removeEventListener("resize", updatePreviewBounds);
    };
  }, [previewImage]);
  const CurrentScenarioIcon = useMemo(
    () =>
      resolveSessionIconComponent({
        icon: currentScenarioIconId,
        label: currentScenarioLabel,
        sessionKey: currentSessionKey,
      }),
    [currentScenarioIconId, currentScenarioLabel, currentSessionKey],
  );

  const loadGatewayStatus = useCallback(async () => {
    const status = await window.electronAPI.gatewayStatus();
    return status;
  }, []);

  const loadSessionUsage = useCallback(async (client: GatewayBrowserClient, sessionKey: string) => {
    const res = await client.request<{
      defaults?: { contextTokens?: number | null };
      sessions?: Array<{
        key: string;
        icon?: string;
        totalTokens?: number;
        contextTokens?: number;
      }>;
    }>("sessions.list", {});
    const row = Array.isArray(res.sessions)
      ? res.sessions.find((entry) => entry?.key === sessionKey)
      : undefined;
    const totalTokens = typeof row?.totalTokens === "number" ? row.totalTokens : null;
    const contextTokens =
      typeof row?.contextTokens === "number"
        ? row.contextTokens
        : typeof res.defaults?.contextTokens === "number"
          ? res.defaults.contextTokens
          : null;
    const remainingTokens =
      typeof totalTokens === "number" && typeof contextTokens === "number"
        ? Math.max(0, contextTokens - totalTokens)
        : null;
    const runtime = getSessionRuntime(sessionKey);
    runtime.usageLoaded = true;
    if (currentSessionKeyRef.current === sessionKey) {
      setCurrentScenarioIconId(typeof row?.icon === "string" ? row.icon : null);
    }
    setSessionUsageState(sessionKey, { totalTokens, contextTokens, remainingTokens });
  }, [getSessionRuntime, setSessionUsageState]);

  const refreshSessionUsage = useCallback(
    (client: GatewayBrowserClient, sessionKey: string) => {
      void loadSessionUsage(client, sessionKey).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    },
    [loadSessionUsage],
  );

  const appendOrUpdateText = useCallback((params: {
    sessionKey: string;
    key: string;
    role: ChatRole;
    runId?: string;
    seq: number;
    text?: string;
    artifacts?: TimelineArtifact[];
    delta?: string;
    timestamp?: number;
    streaming?: boolean;
    final?: boolean;
  }) => {
    setSessionTimeline(params.sessionKey, (prev) => {
      const idx = prev.findIndex((item) => item.kind === "text" && item.id === params.key);
      const ts = params.timestamp ?? Date.now();
      if (idx === -1) {
        const nextText = normalizeTextDelta("", params.text, params.delta);
        if (!nextText.trim()) {
          return prev;
        }
        const next: TextItem = {
          kind: "text",
          id: params.key,
          sortSeq: params.seq,
          timestamp: ts,
          role: params.role,
          text: nextText,
          artifacts: params.artifacts,
          runId: params.runId,
          streaming: params.streaming,
          final: params.final,
        };
        return [...prev, next].toSorted(compareTimeline);
      }
      const current = prev[idx] as TextItem;
      const nextText = normalizeTextDelta(current.text, params.text, params.delta);
      if (nextText === current.text && current.streaming === params.streaming && current.final === params.final) {
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...current,
        text: nextText,
        artifacts: params.artifacts ?? current.artifacts,
        sortSeq: Math.min(current.sortSeq, params.seq),
        streaming: params.streaming,
        final: params.final ?? current.final,
      };
      return next;
    });
  }, [setSessionTimeline]);

  const markRunFinished = useCallback((sessionKey: string, runId: string | null) => {
    if (!runId) {
      return;
    }
    setSessionTimeline(sessionKey, (prev) =>
      prev.map((item) => {
        if (item.kind !== "text") {
          return item;
        }
        if (item.runId !== runId) {
          return item;
        }
        if (!item.streaming) {
          return item;
        }
        return { ...item, streaming: false };
      }),
    );
  }, [setSessionTimeline]);

  const markLastAssistantAsFinal = useCallback((sessionKey: string, runId: string | null) => {
    if (!runId) {
      return;
    }
    setSessionTimeline(sessionKey, (prev) => {
      let targetId: string | null = null;
      for (const item of prev) {
        if (item.kind !== "text") {
          continue;
        }
        if (item.runId !== runId || item.role !== "assistant") {
          continue;
        }
        if (!targetId) {
          targetId = item.id;
          continue;
        }
        const current = prev.find((entry) => entry.kind === "text" && entry.id === targetId) as
          | TextItem
          | undefined;
        if (!current) {
          targetId = item.id;
          continue;
        }
        if (item.sortSeq > current.sortSeq || (item.sortSeq === current.sortSeq && item.timestamp >= current.timestamp)) {
          targetId = item.id;
        }
      }
      if (!targetId) {
        return prev;
      }
      let changed = false;
      const next = prev.map((item) => {
        if (item.kind !== "text" || item.runId !== runId || item.role !== "assistant") {
          return item;
        }
        const shouldBeFinal = item.id === targetId;
        if (item.final === shouldBeFinal) {
          return item;
        }
        changed = true;
        return { ...item, final: shouldBeFinal };
      });
      return changed ? next : prev;
    });
  }, [setSessionTimeline]);

  const finalizeExistingAssistantMessage = useCallback((params: {
    sessionKey: string;
    runId: string | null;
    text: string;
    seq: number;
    timestamp: number;
  }) => {
    if (!params.runId) {
      return false;
    }
    const comparableText = normalizeComparableMessageText(params.text);
    if (!comparableText) {
      return false;
    }
    let matched = false;
    setSessionTimeline(params.sessionKey, (prev) => {
      let targetIndex = -1;
      for (let index = prev.length - 1; index >= 0; index -= 1) {
        const item = prev[index];
        if (item.kind !== "text" || item.role !== "assistant" || item.runId !== params.runId) {
          continue;
        }
        if (normalizeComparableMessageText(item.text) !== comparableText) {
          continue;
        }
        targetIndex = index;
        break;
      }
      if (targetIndex === -1) {
        return prev;
      }
      matched = true;
      const current = prev[targetIndex] as TextItem;
      const next = [...prev];
      next[targetIndex] = {
        ...current,
        text: params.text,
        sortSeq: Math.min(current.sortSeq, params.seq),
        timestamp: Math.min(current.timestamp, params.timestamp),
        streaming: false,
        final: true,
      };
      return next;
    });
    return matched;
  }, [setSessionTimeline]);

  const settleToolsForRun = useCallback((sessionKey: string, runId: string | null, status: ToolStatus) => {
    if (!runId) {
      return;
    }
    setSessionTimeline(sessionKey, (prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.kind !== "tool" || item.runId !== runId || item.status !== "running") {
          return item;
        }
        changed = true;
        return { ...item, status };
      });
      return changed ? next : prev;
    });
  }, [setSessionTimeline]);

  const finalizeRunState = useCallback((sessionKey: string, runId: string | null, toolStatus: ToolStatus = "completed") => {
    const runtime = getSessionRuntime(sessionKey);
    markRunFinished(sessionKey, runId);
    settleToolsForRun(sessionKey, runId, toolStatus);
    setSessionActiveRunId(sessionKey, (prev) => (prev === runId ? null : prev));
    setSessionCompactingRunId(sessionKey, (prev) => (prev === runId ? null : prev));
    if (runId) {
      runtime.settledRunIds.add(runId);
      runtime.runSeqBase.delete(runId);
    }
    runtime.streamSegments.delete(runId ?? "__unknown__");
  }, [getSessionRuntime, markRunFinished, setSessionActiveRunId, setSessionCompactingRunId, settleToolsForRun]);

  const upsertRunError = useCallback((params: {
    sessionKey: string;
    runId?: string;
    seq: number;
    timestamp: number;
    reason: string;
    description?: string;
  }) => {
    const key = params.runId ? `run:${params.runId}:error` : nextId("run-error");
    const reason = params.reason.trim() || "Execution error.";
    const description = params.description?.trim() || describeExecutionError(reason);
    setSessionTimeline(params.sessionKey, (prev) => {
      const idx = prev.findIndex((item) => item.kind === "error" && item.id === key);
      if (idx === -1) {
        const next: ErrorItem = {
          kind: "error",
          id: key,
          sortSeq: params.seq,
          timestamp: params.timestamp,
          reason,
          description,
          runId: params.runId,
        };
        return [...prev, next].toSorted(compareTimeline);
      }
      const current = prev[idx] as ErrorItem;
      if (current.reason === reason && current.description === description) {
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...current,
        sortSeq: Math.min(current.sortSeq, params.seq),
        timestamp: params.timestamp,
        reason,
        description,
      };
      return next;
    });
  }, [setSessionTimeline]);

  const removeRunError = useCallback((sessionKey: string, runId: string | null | undefined) => {
    if (!runId) {
      return;
    }
    const errorKey = `run:${runId}:error`;
    setSessionTimeline(sessionKey, (prev) => {
      const next = prev.filter((item) => item.id !== errorKey);
      return next.length === prev.length ? prev : next;
    });
  }, [setSessionTimeline]);

  const clearReconnectStatus = useCallback((sessionKey: string, runId?: string | null) => {
    setSessionReconnectStatus(sessionKey, (prev) => {
      if (!prev) {
        return prev;
      }
      if (runId && prev.runId !== runId) {
        return prev;
      }
      return null;
    });
  }, [setSessionReconnectStatus]);

  const upsertTool = useCallback((params: {
    sessionKey: string;
    runId?: string;
    toolCallId: string;
    seq: number;
    timestamp: number;
    name: string;
    args?: unknown;
    phase: "start" | "update" | "result";
    output?: string;
    isError?: boolean;
  }) => {
    const key = `tool:${params.toolCallId}`;
    const runtime = getSessionRuntime(params.sessionKey);
    const applyCompletion = (status: ToolStatus, output?: string) => {
      setSessionTimeline(params.sessionKey, (prev) => {
        const idx = prev.findIndex((item) => item.kind === "tool" && item.id === key);
        if (idx === -1) {
          return prev;
        }
        const current = prev[idx] as ToolItem;
        const next = [...prev];
        next[idx] = {
          ...current,
          status,
          output: output ?? current.output,
        };
        return next;
      });
    };

    setSessionTimeline(params.sessionKey, (prev) => {
      const idx = prev.findIndex((item) => item.kind === "tool" && item.id === key);
      if (idx === -1) {
        const created: ToolItem = {
          kind: "tool",
          id: key,
          toolCallId: params.toolCallId,
          runId: params.runId,
          sortSeq: params.seq,
          timestamp: params.timestamp,
          name: params.name,
          args: params.args ?? {},
          output: params.output,
          status: params.phase === "result" ? (params.isError ? "error" : "completed") : "running",
        };
        return [...prev, created].toSorted(compareTimeline);
      }
      const current = prev[idx] as ToolItem;
      const next = [...prev];
      const nextStatus =
        params.phase === "result"
          ? params.isError
            ? "error"
            : "completed"
          : current.status;
      next[idx] = {
        ...current,
        runId: params.runId ?? current.runId,
        name: params.name || current.name,
        args: params.phase === "start" ? params.args ?? current.args : current.args,
        output: params.phase === "result" ? (params.output ?? current.output) : current.output,
        sortSeq: Math.min(current.sortSeq, params.seq),
        status: nextStatus,
      };
      return next;
    });

    if (params.phase === "result") {
      const timerMap = runtime.toolTimers;
      const existing = timerMap.get(key);
      if (existing != null) {
        window.clearTimeout(existing);
      }
      const startedAt = Date.now();
      const timer = window.setTimeout(() => {
        applyCompletion(params.isError ? "error" : "completed", params.output);
        timerMap.delete(key);
      }, TOOL_RUNNING_MIN_VISIBLE_MS);
      timerMap.set(key, timer);

      window.setTimeout(() => {
        const still = timerMap.get(key);
        if (still === timer) {
          window.clearTimeout(timer);
          timerMap.delete(key);
          applyCompletion(params.isError ? "error" : "completed", params.output);
        }
      }, TOOL_RUNNING_MIN_VISIBLE_MS + 20);

      // If tool already visible long enough, complete immediately
      setSessionTimeline(params.sessionKey, (prev) => {
        const idx = prev.findIndex((item) => item.kind === "tool" && item.id === key);
        if (idx === -1) {
          return prev;
        }
        const current = prev[idx] as ToolItem;
        const visibleMs = startedAt - current.timestamp;
        if (visibleMs < TOOL_RUNNING_MIN_VISIBLE_MS) {
          return prev;
        }
        if (timerMap.has(key)) {
          window.clearTimeout(timerMap.get(key));
          timerMap.delete(key);
        }
        const next = [...prev];
        next[idx] = {
          ...current,
          status: params.isError ? "error" : "completed",
          output: params.output ?? current.output,
        };
        return next;
      });
    }
  }, [getSessionRuntime, setSessionTimeline]);

  const loadHistory = useCallback(async (client: GatewayBrowserClient, sessionKey: string) => {
    const res = await client.request<{ messages?: unknown[] }>("chat.history", {
      sessionKey,
      limit: 200,
    });
    const history = Array.isArray(res.messages) ? res.messages : [];
    console.log("[electron-chat] chat.history loaded", { count: history.length, sessionKey });
    const items: TimelineItem[] = [];
    const toolsByCallId = new Map<string, ToolItem>();
    let fallbackSeq = 1;

    for (const message of history) {
      console.log("[electron-chat] history message", message);
      if (!message || typeof message !== "object") {
        continue;
      }
      const rec = message as Record<string, unknown>;
      const nested =
        rec.message && typeof rec.message === "object" ? (rec.message as Record<string, unknown>) : null;
      const role = typeof rec.role === "string" ? rec.role.toLowerCase() : "";
      const stopReasonRaw =
        (typeof rec.stopReason === "string" ? rec.stopReason : undefined) ??
        (typeof nested?.stopReason === "string" ? nested.stopReason : undefined) ??
        "";
      const stopReason = stopReasonRaw.toLowerCase();
      const timestamp =
        typeof rec.timestamp === "number"
          ? rec.timestamp
          : typeof rec.ts === "number"
            ? rec.ts
            : Date.now();
      const baseSeq = typeof rec.seq === "number" ? rec.seq : fallbackSeq++;

      const thinking = readThinkingText(message);
      if (thinking) {
        items.push({
          kind: "text",
          id: `history:${sessionKey}:thinking:${baseSeq}:${timestamp}`,
          sortSeq: baseSeq,
          timestamp,
          role: "thinking",
          text: thinking,
          streaming: false,
        });
      }

      const text = readContentText(message);
      if (isCompactionSystemMessage(message, text)) {
        continue;
      }
      if (text) {
        const textRole: ChatRole =
          role === "user"
            ? "user"
            : role === "assistant"
              ? "assistant"
              : role === "system"
                ? "system"
                : "assistant";
        if (textRole === "assistant" && isSilentReplyText(text, SILENT_REPLY_TOKEN)) {
          continue;
        }
        if (textRole === "user") {
          console.log("[electron-chat] history user message", {
            sessionKey,
            timestamp,
            message,
            text,
          });
        }
        items.push({
          kind: "text",
          id: `history:${sessionKey}:text:${textRole}:${baseSeq}:${timestamp}`,
          sortSeq: baseSeq + 0.01,
          timestamp,
          role: textRole,
          text,
          streaming: false,
          final: textRole === "assistant" && stopReason === "stop",
        });
      }

      const tools = parseToolBlocks(message);
      for (const tool of tools) {
        const toolStatus: ToolStatus = tool.output
          ? "completed"
          : stopReason === "aborted" || stopReason === "error"
            ? "error"
            : "running";
        const existing = toolsByCallId.get(tool.toolCallId);
        if (!existing) {
          toolsByCallId.set(tool.toolCallId, {
            kind: "tool",
            id: `tool:${tool.toolCallId}`,
            toolCallId: tool.toolCallId,
            runId: undefined,
            sortSeq: baseSeq + 0.02,
            timestamp,
            name: tool.name,
            args: tool.args,
            output: tool.output,
            status: toolStatus,
          });
          continue;
        }
        toolsByCallId.set(tool.toolCallId, {
          ...existing,
          sortSeq: Math.min(existing.sortSeq, baseSeq + 0.02),
          timestamp: Math.min(existing.timestamp, timestamp),
          name: tool.name || existing.name,
          args: tool.args ?? existing.args,
          output: tool.output ?? existing.output,
          status:
            tool.output
              ? "completed"
              : existing.status === "running"
                ? toolStatus
                : existing.status,
        });
      }
    }

    items.push(...toolsByCallId.values());
    const runtime = getSessionRuntime(sessionKey);
    runtime.historyLoaded = true;
    setSessionTimeline(sessionKey, (prev) => {
      const localErrors = prev.filter((item): item is ErrorItem => item.kind === "error");
      const merged = [...items, ...localErrors];
      return merged.toSorted(compareTimeline);
    });
    setSessionLoading(sessionKey, false);
  }, [getSessionRuntime, setSessionLoading, setSessionTimeline]);

  const connectGateway = useCallback(
    async (status: GatewayStatus) => {
      if (!status.running) {
        setConnected(false);
        setConnectionNotice({
          message: "Gateway unavailable. Reconnecting...",
          tone: "warning",
        });
        return;
      }
      setConnectionNotice(null);
      let connectConfig: GatewayConnectConfig;
      try {
        connectConfig = await window.electronAPI.gatewayConnectConfig();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        setError(`Gateway connect config unavailable: ${reason}`);
        setConnected(false);
        return;
      }
      if (!connectConfig.token || !connectConfig.wsUrl) {
        setError("Gateway token missing in config; cannot connect.");
        setConnected(false);
        return;
      }
      const client = new GatewayBrowserClient({
        url: connectConfig.wsUrl,
        token: connectConfig.token ?? undefined,
        clientName: "openclaw-control-ui",
        mode: "webchat",
        instanceId: `bustly-electron-chat-${Date.now()}`,
        onHello: () => {
          setConnected(true);
          setError(null);
          setConnectionNotice(null);
          const sessionKey = currentSessionKeyRef.current;
          const runtime = getSessionRuntime(sessionKey);
          if (!runtime.historyLoaded) {
            void loadHistory(client, sessionKey).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
            });
          } else {
            setSessionLoading(sessionKey, false);
          }
          void loadSessionUsage(client, sessionKey).catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        },
        onClose: ({ code, reason, error: closeError }) => {
          setConnected(false);
          if (closeError) {
            setConnectionNotice(null);
            setError(closeError.message);
          } else {
            setError(null);
            setConnectionNotice({
              message: "Gateway disconnected. Reconnecting...",
              tone: "warning",
            });
          }
          console.warn("[electron-chat] gateway disconnected", {
            code,
            reason: reason || "no reason",
            error: closeError,
          });
        },
        onEvent: (evt: GatewayEventFrame) => {
          if (evt.event === "health") {
            return;
          }
          console.log("[electron-chat] received event", evt.event, evt.payload);
          if (evt.event === "chat") {
            const payload = evt.payload as {
              runId?: string;
              state?: string;
              sessionKey?: string;
              message?: unknown;
              errorMessage?: string;
            };
            const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : "";
            if (!payload || !sessionKey) {
              return;
            }
            const runtime = getSessionRuntime(sessionKey);
            const runId = typeof payload.runId === "string" ? payload.runId : null;
            if (runId && runtime.discardedRunIds.has(runId)) {
              return;
            }
            if (runId && runtime.settledRunIds.has(runId) && payload.state !== "final" && payload.state !== "aborted" && payload.state !== "error") {
              return;
            }
            const terminalState = resolveChatTerminalState(payload);
            if (payload.state === "delta") {
              return;
            }
            if (terminalState === "final") {
              finalizeRunState(sessionKey, runId, "completed");
              clearReconnectStatus(sessionKey, runId);
              if (!payload.message) {
                return;
              }
              const messageText = readContentText(payload.message);
              if (!messageText) {
                return;
              }
              const timestamp =
                payload.message &&
                typeof payload.message === "object" &&
                typeof (payload.message as { timestamp?: unknown }).timestamp === "number"
                  ? (payload.message as { timestamp: number }).timestamp
                  : Date.now();
              const command = isCommandMessage(payload.message);
              const role = command ? "system" : readMessageRole(payload.message);
              const nextSeq = runtime.seqCounter++;
              if (
                role === "assistant" &&
                finalizeExistingAssistantMessage({
                  sessionKey,
                  runId,
                  text: messageText,
                  seq: nextSeq,
                  timestamp,
                })
              ) {
                markLastAssistantAsFinal(sessionKey, runId);
                notifySidebarTasksRefresh();
                return;
              }
              appendOrUpdateText({
                sessionKey,
                key: command && runId ? `run:${runId}:command:status` : `chat:${runId ?? nextId("final")}`,
                role,
                runId: runId ?? undefined,
                seq: nextSeq,
                text: messageText,
                timestamp,
                streaming: false,
                final: role === "assistant",
              });
              if (role === "assistant") {
                markLastAssistantAsFinal(sessionKey, runId);
              }
              if (command) {
                void loadHistory(client, sessionKey).catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                });
                refreshSessionUsage(client, sessionKey);
              }
              notifySidebarTasksRefresh();
              return;
            }
            if (terminalState === "aborted" || terminalState === "error") {
              finalizeRunState(sessionKey, runId, "error");
              clearReconnectStatus(sessionKey, runId);
              if (terminalState === "error") {
                upsertRunError({
                  sessionKey,
                  runId: runId ?? undefined,
                  seq: runtime.seqCounter++,
                  timestamp: Date.now(),
                  reason: payload.errorMessage ?? "Execution error.",
                });
              }
              refreshSessionUsage(client, sessionKey);
              notifySidebarTasksRefresh();
              return;
            }
            return;
          }
          if (evt.event === "agent") {
            const payload = evt.payload as {
              runId?: string;
              seq?: number;
              stream?: string;
              ts?: number;
              sessionKey?: string;
              data?: Record<string, unknown>;
            };
            const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : "";
            if (!payload || !sessionKey) {
              return;
            }
            const runtime = getSessionRuntime(sessionKey);
            const runId = typeof payload.runId === "string" ? payload.runId : null;
            if (runId && runtime.discardedRunIds.has(runId)) {
              return;
            }
            if (runId && runtime.settledRunIds.has(runId) && payload.stream !== "lifecycle" && payload.stream !== "error") {
              return;
            }
            let seq = runtime.seqCounter++;
            if (runId) {
              let base = runtime.runSeqBase.get(runId);
              if (base == null) {
                base = runtime.seqCounter;
                runtime.runSeqBase.set(runId, base);
                runtime.seqCounter += 100_000;
              }
              if (typeof payload.seq === "number" && Number.isFinite(payload.seq)) {
                seq = base + payload.seq;
              } else {
                seq = base + (runtime.seqCounter++ % 100_000);
              }
            } else if (typeof payload.seq === "number" && Number.isFinite(payload.seq)) {
              seq = payload.seq;
            }
            const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
            const stream = typeof payload.stream === "string" ? payload.stream : "";
            const data = payload.data ?? {};
            const runKey = runId ?? "__unknown__";
            const segmentState =
              runtime.streamSegments.get(runKey) ??
              { assistant: 0, assistantClosed: true, thinking: 0, thinkingOpen: false };

            if (
              runId &&
              stream !== "lifecycle" &&
              stream !== "error"
            ) {
              setSessionActiveRunId(sessionKey, runId);
            }

            if (runId && (stream === "assistant" || stream === "thinking" || stream === "tool")) {
              clearReconnectStatus(sessionKey, runId);
            }

            if (stream === "lifecycle" && data.phase === "reconnecting" && runId) {
              setSessionReconnectStatus(sessionKey, {
                runId,
              });
              return;
            }

            if (stream === "assistant") {
              const isFinalChunk = data.final === true;
              if (segmentState.assistant === 0 || segmentState.assistantClosed) {
                segmentState.assistant += 1;
                segmentState.assistantClosed = false;
              }
              runtime.streamSegments.set(runKey, segmentState);
              appendOrUpdateText({
                sessionKey,
                key: `run:${runId ?? "unknown"}:assistant:${segmentState.assistant}`,
                role: "assistant",
                runId: runId ?? undefined,
                seq,
                text: typeof data.text === "string" ? data.text : undefined,
                delta: typeof data.delta === "string" ? data.delta : undefined,
                timestamp: ts,
                streaming: !isFinalChunk,
                final: false,
              });
              if (isFinalChunk) {
                segmentState.assistantClosed = true;
                runtime.streamSegments.set(runKey, segmentState);
              }
              return;
            }

            if (stream === "thinking") {
              if (!segmentState.thinkingOpen) {
                segmentState.thinking += 1;
                segmentState.thinkingOpen = true;
              }
              runtime.streamSegments.set(runKey, segmentState);
              appendOrUpdateText({
                sessionKey,
                key: `run:${runId ?? "unknown"}:thinking:${segmentState.thinking}`,
                role: "thinking",
                runId: runId ?? undefined,
                seq,
                text: typeof data.text === "string" ? data.text : undefined,
                delta: typeof data.delta === "string" ? data.delta : undefined,
                timestamp: ts,
                streaming: true,
              });
              return;
            }

            if (stream === "tool") {
              segmentState.thinkingOpen = false;
              runtime.streamSegments.set(runKey, segmentState);
              const phase =
                data.phase === "start" || data.phase === "update" || data.phase === "result"
                  ? data.phase
                  : "update";
              const toolCallId = typeof data.toolCallId === "string" ? data.toolCallId : "";
              if (!toolCallId) {
                return;
              }
              upsertTool({
                sessionKey,
                runId: runId ?? undefined,
                toolCallId,
                seq,
                timestamp: ts,
                name: typeof data.name === "string" ? data.name : "tool",
                args: data.args,
                phase,
                output: typeof data.output === "string" ? data.output : extractToolText(data.output),
                isError: data.isError === true,
              });
              return;
            }

            if (stream === "compaction") {
              const phase = typeof data.phase === "string" ? data.phase : "";
              if (phase === "start" && runId) {
                setSessionCompactingRunId(sessionKey, runId);
              }
              if (phase === "end" || phase === "error") {
                setSessionCompactingRunId(sessionKey, (prev) => (prev === runId ? null : prev));
                refreshSessionUsage(client, sessionKey);
              }
              return;
            }

            if (stream === "error") {
              return;
            }

            const terminalState = resolveAgentTerminalState({ stream, data });
            if (terminalState) {
              finalizeRunState(sessionKey, runId, terminalState === "final" ? "completed" : "error");
              if (terminalState === "aborted" && runId) {
                runtime.discardedRunIds.add(runId);
              }
              if (terminalState === "final") {
                markLastAssistantAsFinal(sessionKey, runId);
              }
              refreshSessionUsage(client, sessionKey);
              notifySidebarTasksRefresh();
              return;
            }

            if (stream === "lifecycle" && data.phase === "error") {
              return;
            }
            return;
          }
        },
      });
      clientRef.current?.stop();
      clientRef.current = client;
      client.start();
    },
    [
      appendOrUpdateText,
      clearReconnectStatus,
      finalizeRunState,
      getSessionRuntime,
      loadHistory,
      loadSessionUsage,
      markLastAssistantAsFinal,
      refreshSessionUsage,
      setSessionActiveRunId,
      setSessionCompactingRunId,
      setSessionLoading,
      setSessionReconnectStatus,
      upsertRunError,
      upsertTool,
    ],
  );

  useEffect(() => {
    let disposed = false;

    const loadWorkspaceState = async () => {
      try {
        const summary = await listWorkspaceSummaries();
        if (disposed) {
          return;
        }
        const workspaceId = summary.activeWorkspaceId || summary.workspaces[0]?.id || "";
        const activeWorkspace = summary.workspaces.find((entry) => entry.id === workspaceId);
        setActiveWorkspaceId(workspaceId);
        setSubscriptionExpired(activeWorkspace?.expired === true);
        setSubscriptionActionText(activeWorkspace?.buttonText?.trim() || "Upgrade");
      } catch {
        if (!disposed) {
          setActiveWorkspaceId("");
          setSubscriptionExpired(false);
          setSubscriptionActionText("Upgrade");
        }
      }
    };

    void loadWorkspaceState();
    const unsubscribe = window.electronAPI.onBustlyLoginRefresh(() => {
      void loadWorkspaceState();
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!gatewayReady) {
      setConnected(false);
      setSessionLoading(currentSessionKeyRef.current, true);
      setConnectionNotice({
        message: "Waiting for gateway...",
        tone: "warning",
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const status = await loadGatewayStatus();
        if (cancelled) {
          return;
        }
        await connectGateway(status);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(currentSessionKeyRef.current, false);
        }
      }
    })();

    const interval = window.setInterval(() => {
      void loadGatewayStatus()
        .then((status) => {
          if (!status.running) {
            setConnected(false);
            setConnectionNotice({
              message: "Gateway unavailable. Reconnecting...",
              tone: "warning",
            });
          }
        })
        .catch(() => {});
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      clientRef.current?.stop();
      clientRef.current = null;
      for (const runtime of sessionRuntimesRef.current.values()) {
        for (const timer of runtime.toolTimers.values()) {
          window.clearTimeout(timer);
        }
        runtime.toolTimers.clear();
      }
    };
  }, [connectGateway, ensureGatewayReady, gatewayReady, loadGatewayStatus, setSessionLoading]);

  useEffect(() => {
    const client = clientRef.current;
    const runtime = getSessionRuntime(currentSessionKey);
    if (!connected || !client) {
      setSessionLoading(currentSessionKey, false);
      return;
    }
    if (!runtime.historyLoaded) {
      setSessionLoading(currentSessionKey, true);
      void loadHistory(client, currentSessionKey).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }
    void loadSessionUsage(client, currentSessionKey).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [connected, currentSessionKey, getSessionRuntime, loadHistory, loadSessionUsage, location.search, setSessionLoading]);

  const appendContextSelections = useCallback((selected: ChatContextPathSelection[]) => {
    if (selected.length > 0) {
      console.log("[electron-chat] context paths added", selected);
    }
    setSessionContextPaths(currentSessionKey, (prev) => {
      const seen = new Set(prev.map((entry) => entry.path));
      const nextEntries = selected
        .filter((entry): entry is ChatContextPathSelection => Boolean(entry?.path && entry?.name))
        .filter((entry) => {
          if (seen.has(entry.path)) {
            return false;
          }
          seen.add(entry.path);
          return true;
        })
        .map((entry) => ({
          id: nextId("ctx"),
          path: entry.path,
          name: entry.name,
          kind: inferInputArtifactKind(entry),
          imageUrl: entry.imageUrl,
        }));
      return nextEntries.length > 0 ? [...prev, ...nextEntries] : prev;
    });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const explicitSessionKey = searchParams.get("session")?.trim();
    const prompt = searchParams.get("prompt")?.trim();
    const contextPath = searchParams.get("contextPath")?.trim();
    const contextName = searchParams.get("contextName")?.trim();
    const contextKind = searchParams.get("contextKind")?.trim();
    if (!explicitSessionKey) {
      return;
    }

    let applied = false;
    if (prompt && lastAppliedPromptRef.current !== prompt) {
      lastAppliedPromptRef.current = prompt;
      pendingPromptFocusRef.current = true;
      setSessionDraft(currentSessionKey, prompt);
      window.requestAnimationFrame(() => {
        composerRef.current?.focus();
        composerRef.current?.setSelectionRange(prompt.length, prompt.length);
      });
      window.setTimeout(() => {
        composerRef.current?.focus();
        composerRef.current?.setSelectionRange(prompt.length, prompt.length);
      }, 80);
      applied = true;
    }

    const contextSignature = contextPath ? `${contextPath}::${contextName || ""}::${contextKind || ""}` : null;
    if (contextPath && contextSignature !== lastAppliedContextRef.current) {
      lastAppliedContextRef.current = contextSignature;
      appendContextSelections([
        {
          path: contextPath,
          name: contextName || contextPath.split(/[\\/]/).pop() || contextPath,
          kind: contextKind === "directory" ? "directory" : "file",
        },
      ]);
      applied = true;
    }

    if (!applied) {
      return;
    }

    searchParams.delete("prompt");
    searchParams.delete("contextPath");
    searchParams.delete("contextName");
    searchParams.delete("contextKind");
    void navigate(
      {
        pathname: location.pathname,
        search: searchParams.toString() ? `?${searchParams.toString()}` : "",
      },
      { replace: true },
    );
  }, [appendContextSelections, currentSessionKey, location.pathname, location.search, navigate, setSessionDraft]);

  useEffect(() => {
    if (!pendingPromptFocusRef.current || !connected || sending || subscriptionExpired || !draft.trim()) {
      return;
    }
    pendingPromptFocusRef.current = false;
    window.requestAnimationFrame(() => {
      const textarea = composerRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(draft.length, draft.length);
    });
  }, [connected, draft, sending, subscriptionExpired]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const handleScroll = () => {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      const isNotAtBottom = distanceFromBottom > 100;
      const isOverOnePage = element.scrollHeight > element.clientHeight;
      shouldStickToBottomRef.current = !isNotAtBottom;
      setShowScrollBottom(isNotAtBottom && isOverOnePage);
    };
    handleScroll();
    element.addEventListener("scroll", handleScroll);
    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    });
    shouldStickToBottomRef.current = true;
    setShowScrollBottom(false);
  }, []);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }
    scrollToBottom("auto");
  }, [scrollToBottom, timeline]);

  useEffect(() => {
    const element = composerAreaRef.current;
    if (!element) {
      return;
    }
    const updateComposerAreaHeight = () => {
      setComposerAreaHeight(element.offsetHeight);
      if (shouldStickToBottomRef.current) {
        window.requestAnimationFrame(() => {
          scrollToBottom("auto");
        });
      }
    };
    updateComposerAreaHeight();
    const observer = new ResizeObserver(() => {
      updateComposerAreaHeight();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [draft]);

  const sendPreparedChatMessage = useCallback(async (params: {
    sessionKey: string;
    draftText: string;
    attachments: Attachment[];
    contextPaths: ContextPath[];
    clearComposer: boolean;
  }) => {
    const msg = params.draftText.trim();
    if (
      subscriptionExpired ||
      !connected ||
      (!msg && params.attachments.length === 0 && params.contextPaths.length === 0) ||
      sending ||
      !clientRef.current
    ) {
      return false;
    }
    const selectedModelRef =
      (CHAT_MODEL_LEVELS.find((entry) => entry.id === modelLevel) ?? CHAT_MODEL_LEVELS[0]).modelRef;
    const patchModelResult = await window.electronAPI.gatewayPatchSessionModel(params.sessionKey, selectedModelRef);
    if (!patchModelResult.success) {
      setError(patchModelResult.error ?? "Failed to apply model selection.");
      return false;
    }
    const outgoingArtifacts: ChatInputArtifact[] = [
      ...params.attachments.map((attachment) => ({
        kind: "image" as const,
        name: attachment.name,
      })),
      ...params.contextPaths.map((entry) => ({
        kind: entry.kind,
        name: entry.name,
        path: entry.path,
      })),
    ];
    const timelineArtifacts: TimelineArtifact[] = [
      ...params.attachments.map((attachment) => ({
        kind: "image" as const,
        name: attachment.name,
        imageUrl: attachment.dataUrl,
      })),
      ...params.contextPaths.map((entry) => ({
        kind: entry.kind,
        name: entry.name,
        path: entry.path,
      })),
    ];
    const outgoingMessage = buildInputArtifactsMessage(msg, outgoingArtifacts);

    const localSeq = getSessionRuntime(params.sessionKey).seqCounter++;
    const userItem: TextItem = {
      kind: "text",
      id: nextId("user"),
      sortSeq: localSeq,
      timestamp: Date.now(),
      role: "user",
      text: outgoingMessage,
      artifacts: timelineArtifacts,
      streaming: false,
    };
    console.log("[electron-chat] local user message", {
      sessionKey: params.sessionKey,
      outgoingMessage,
      timelineArtifacts,
      outgoingArtifacts,
    });
    setSessionTimeline(params.sessionKey, (prev) => [...prev, userItem].sort(compareTimeline));
    if (params.clearComposer) {
      setSessionDraft(params.sessionKey, "");
      setSessionAttachments(params.sessionKey, []);
      setSessionContextPaths(params.sessionKey, []);
    }
    setSessionSending(params.sessionKey, true);
    setError(null);

    const idempotencyKey = nextId("run");
    getSessionRuntime(params.sessionKey).retryPayloads.set(idempotencyKey, {
      draft: msg,
      attachments: params.attachments.map((attachment) => ({ ...attachment })),
      contextPaths: params.contextPaths.map((entry) => ({ ...entry })),
    });
    getSessionRuntime(params.sessionKey).settledRunIds.delete(idempotencyKey);
    setSessionActiveRunId(params.sessionKey, idempotencyKey);
    setSessionCompactingRunId(params.sessionKey, null);

    try {
      const apiAttachments = params.attachments
        .map((att) => {
          const parsed = parseDataUrl(att.dataUrl);
          if (!parsed) {
            return null;
          }
          return {
            type: "image",
            mimeType: parsed.mimeType,
            content: parsed.content,
          };
        })
        .filter((att): att is { type: "image"; mimeType: string; content: string } => Boolean(att));

      await clientRef.current.request("chat.send", {
        sessionKey: params.sessionKey,
        message: outgoingMessage,
        deliver: false,
        idempotencyKey,
        attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
      });
      notifySidebarTasksRefresh();
      void loadSessionUsage(clientRef.current, params.sessionKey).catch(() => {});
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSessionActiveRunId(params.sessionKey, null);
      setSessionCompactingRunId(params.sessionKey, null);
      return false;
    } finally {
      setSessionSending(params.sessionKey, false);
    }
  }, [
    connected,
    getSessionRuntime,
    loadSessionUsage,
    modelLevel,
    sending,
    setSessionActiveRunId,
    setSessionAttachments,
    setSessionCompactingRunId,
    setSessionContextPaths,
    setSessionDraft,
    setSessionSending,
    setSessionTimeline,
    subscriptionExpired,
  ]);

  const sendChatMessage = useCallback(async () => {
    await sendPreparedChatMessage({
      sessionKey: currentSessionKey,
      draftText: draft,
      attachments,
      contextPaths,
      clearComposer: true,
    });
  }, [attachments, contextPaths, currentSessionKey, draft, sendPreparedChatMessage]);

  useEffect(() => {
    if (!activeWorkspaceId || !connected || !clientRef.current || sending) {
      return;
    }
    const expectedBootstrapSessionKey = buildBustlyWorkspaceMainSessionKey(activeWorkspaceId);
    if (currentSessionKey !== expectedBootstrapSessionKey) {
      return;
    }
    if (!/^agent:bustly-[a-z0-9_-]+:main$/i.test(currentSessionKey)) {
      return;
    }
    const runtime = getSessionRuntime(currentSessionKey);
    if (!runtime.historyLoaded) {
      return;
    }
    if (timeline.length > 0) {
      return;
    }
    if (bootstrapWakeAttemptedSessionsRef.current.has(currentSessionKey)) {
      return;
    }
    bootstrapWakeAttemptedSessionsRef.current.add(currentSessionKey);
    void sendPreparedChatMessage({
      sessionKey: currentSessionKey,
      draftText: "Wake up, bustly!",
      attachments: [],
      contextPaths: [],
      clearComposer: false,
    }).then((ok) => {
      if (!ok) {
        bootstrapWakeAttemptedSessionsRef.current.delete(currentSessionKey);
      }
    });
  }, [
    activeWorkspaceId,
    connected,
    currentSessionKey,
    getSessionRuntime,
    sendPreparedChatMessage,
    sending,
    timeline.length,
  ]);

  const handleSend = useCallback(async () => {
    await sendChatMessage();
  }, [sendChatMessage]);

  const handleRetryRun = useCallback(async (runId?: string) => {
    const retryPayload =
      (runId ? getSessionRuntime(currentSessionKey).retryPayloads.get(runId) : undefined) ??
      Array.from(getSessionRuntime(currentSessionKey).retryPayloads.values()).at(-1);
    const retryRunId =
      runId ??
      Array.from(getSessionRuntime(currentSessionKey).retryPayloads.keys()).at(-1);
    if (!retryPayload || !retryRunId || !clientRef.current || !connected || subscriptionExpired || sending) {
      return;
    }
    const selectedModelRef =
      (CHAT_MODEL_LEVELS.find((entry) => entry.id === modelLevel) ?? CHAT_MODEL_LEVELS[0]).modelRef;
    const patchModelResult = await window.electronAPI.gatewayPatchSessionModel(currentSessionKey, selectedModelRef);
    if (!patchModelResult.success) {
      setError(patchModelResult.error ?? "Failed to apply model selection.");
      return;
    }
    const outgoingArtifacts: ChatInputArtifact[] = [
      ...retryPayload.attachments.map((attachment) => ({
        kind: "image" as const,
        name: attachment.name,
      })),
      ...retryPayload.contextPaths.map((entry) => ({
        kind: entry.kind,
        name: entry.name,
        path: entry.path,
      })),
    ];
    const outgoingMessage = buildInputArtifactsMessage(retryPayload.draft, outgoingArtifacts);
    const apiAttachments = retryPayload.attachments
      .map((att) => {
        const parsed = parseDataUrl(att.dataUrl);
        if (!parsed) {
          return null;
        }
        return {
          type: "image",
          mimeType: parsed.mimeType,
          content: parsed.content,
        };
      })
      .filter((att): att is { type: "image"; mimeType: string; content: string } => Boolean(att));

    clearReconnectStatus(currentSessionKey, retryRunId);
    removeRunError(currentSessionKey, retryRunId);
    getSessionRuntime(currentSessionKey).discardedRunIds.delete(retryRunId);
    getSessionRuntime(currentSessionKey).settledRunIds.delete(retryRunId);
    setSessionActiveRunId(currentSessionKey, retryRunId);
    setSessionCompactingRunId(currentSessionKey, null);
    setSessionSending(currentSessionKey, true);
    setError(null);
    try {
      await clientRef.current.request("chat.retry", {
        sessionKey: currentSessionKey,
        runId: retryRunId,
        message: outgoingMessage,
        deliver: false,
        attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
      });
      notifySidebarTasksRefresh();
      void loadSessionUsage(clientRef.current, currentSessionKey).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("unknown method: chat.retry")) {
        const fallbackRunId = nextId("run");
        getSessionRuntime(currentSessionKey).retryPayloads.set(fallbackRunId, {
          draft: retryPayload.draft,
          attachments: retryPayload.attachments.map((attachment) => ({ ...attachment })),
          contextPaths: retryPayload.contextPaths.map((entry) => ({ ...entry })),
        });
        getSessionRuntime(currentSessionKey).settledRunIds.delete(fallbackRunId);
        setSessionActiveRunId(currentSessionKey, fallbackRunId);
        await clientRef.current.request("chat.send", {
          sessionKey: currentSessionKey,
          message: outgoingMessage,
          deliver: false,
          idempotencyKey: fallbackRunId,
          attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
        });
        notifySidebarTasksRefresh();
        void loadSessionUsage(clientRef.current, currentSessionKey).catch(() => {});
        return;
      }
      setError(message);
      setSessionActiveRunId(currentSessionKey, null);
      setSessionCompactingRunId(currentSessionKey, null);
    } finally {
      setSessionSending(currentSessionKey, false);
    }
  }, [
    clearReconnectStatus,
    connected,
    currentSessionKey,
    getSessionRuntime,
    loadSessionUsage,
    modelLevel,
    removeRunError,
    sending,
    setSessionActiveRunId,
    setSessionCompactingRunId,
    setSessionSending,
    subscriptionExpired,
  ]);

  const handleAbort = useCallback(async () => {
    const client = clientRef.current;
    const runId = activeRunId;

    // Abort must clear the local running state immediately so the UI cannot get stuck
    // behind an RPC response that is delayed, missing runIds, or races with reconnects.
    setSessionSending(currentSessionKey, false);
    setSessionActiveRunId(currentSessionKey, null);
    setSessionCompactingRunId(currentSessionKey, null);
    clearReconnectStatus(currentSessionKey, runId);
    if (runId) {
      getSessionRuntime(currentSessionKey).discardedRunIds.add(runId);
      finalizeRunState(currentSessionKey, runId, "error");
    }

    if (!connected || !client) {
      return;
    }

    try {
      const res = await client.request<{ aborted?: boolean; runIds?: string[] }>("chat.abort", {
        sessionKey: currentSessionKey,
        runId: runId ?? undefined,
      });
      let abortedRunIds = Array.isArray(res.runIds)
        ? res.runIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        : runId
          ? [runId]
          : [];

      if ((!res.aborted || abortedRunIds.length === 0) && currentSessionKey) {
        const fallbackRes = await client.request<{ aborted?: boolean; runIds?: string[] }>("chat.abort", {
          sessionKey: currentSessionKey,
        });
        const fallbackRunIds = Array.isArray(fallbackRes.runIds)
          ? fallbackRes.runIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
          : [];
        if (fallbackRunIds.length > 0) {
          abortedRunIds = fallbackRunIds;
        }
      }

      for (const abortedRunId of abortedRunIds) {
        getSessionRuntime(currentSessionKey).discardedRunIds.add(abortedRunId);
        finalizeRunState(currentSessionKey, abortedRunId, "error");
      }
      refreshSessionUsage(client, currentSessionKey);
      notifySidebarTasksRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    activeRunId,
    clearReconnectStatus,
    connected,
    currentSessionKey,
    finalizeRunState,
    getSessionRuntime,
    refreshSessionUsage,
    setSessionActiveRunId,
    setSessionCompactingRunId,
    setSessionSending,
  ]);

  const handleOpenPricing = useCallback(async () => {
    if (!activeWorkspaceId) {
      return;
    }
    await window.electronAPI.bustlyOpenWorkspacePricing(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const handleAttachmentFiles = useCallback(async (
    input: FileList | DataTransferItemList | null,
    clipboardData?: DataTransfer | null,
  ) => {
    if (subscriptionExpired || !input || input.length === 0) {
      return;
    }
    const inputEntries = Array.from({ length: input.length }, (_, index) => input[index]).filter(
      (entry): entry is File | DataTransferItem => Boolean(entry),
    );
    const hasFileLikeEntry = inputEntries.some((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      if ("kind" in entry) {
        return typeof entry.kind === "string" && entry.kind === "file";
      }
      return "name" in entry && "type" in entry;
    });
    if (!hasFileLikeEntry) {
      return;
    }

    const transferPaths = extractNativeTransferPaths(clipboardData);
    const contextSelections: ChatContextPathSelection[] = [];
    const files: File[] = [];
    for (const entry of inputEntries) {
      const directFile =
        entry &&
        typeof entry === "object" &&
        "type" in entry &&
        "name" in entry &&
        typeof (entry).type === "string" &&
        typeof (entry).name === "string"
          ? (entry)
          : null;
      if (directFile) {
        const resolvedSelection = await resolvePastedSelection({
          file: directFile,
          entryPath:
            "path" in directFile && typeof (directFile as File & { path?: unknown }).path === "string"
              ? String((directFile as File & { path?: string }).path)
              : undefined,
          entryName: directFile.name,
          transferPaths,
          fallbackKind: "file",
        });
        if (resolvedSelection.path) {
          contextSelections.push({
            path: resolvedSelection.path,
            name: directFile.name || resolvedSelection.path,
            kind: resolvedSelection.kind,
            imageUrl:
              resolvedSelection.kind === "file" &&
              (directFile.type.startsWith("image/") || looksLikeImagePath(resolvedSelection.path))
                ? await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.addEventListener(
                      "load",
                      () => {
                        if (typeof reader.result === "string") {
                          resolve(reader.result);
                          return;
                        }
                        reject(new Error("Unexpected file reader result type"));
                      },
                      { once: true },
                    );
                    reader.addEventListener(
                      "error",
                      () => {
                        reject(reader.error ?? new Error("Failed to read image"));
                      },
                      { once: true },
                    );
                    reader.readAsDataURL(directFile);
                  }).catch(() => undefined)
                : undefined,
          });
          continue;
        }
        files.push(directFile);
        continue;
      }
      const clipboardItem =
        entry &&
        typeof entry === "object" &&
        "kind" in entry &&
        "getAsFile" in entry &&
        typeof entry.getAsFile === "function"
          ? (entry as unknown as DataTransferItem)
          : null;
      const entryHandle =
        clipboardItem &&
        "webkitGetAsEntry" in clipboardItem &&
        typeof (clipboardItem as unknown as { webkitGetAsEntry?: () => { isDirectory?: boolean; fullPath?: string; name?: string } | null }).webkitGetAsEntry === "function"
          ? (clipboardItem as unknown as { webkitGetAsEntry: () => { isDirectory?: boolean; fullPath?: string; name?: string } | null }).webkitGetAsEntry()
          : null;
      if (entryHandle?.isDirectory && entryHandle.fullPath) {
        const directoryFile =
          clipboardItem && typeof clipboardItem.getAsFile === "function" ? clipboardItem.getAsFile() : null;
        const resolvedSelection = await resolvePastedSelection({
          file: directoryFile ?? undefined,
          entryPath: entryHandle.fullPath,
          entryName: entryHandle.name,
          transferPaths,
          fallbackKind: "directory",
        });
        contextSelections.push({
          path: resolvedSelection.path || entryHandle.fullPath,
          name: entryHandle.name || resolvedSelection.path || entryHandle.fullPath,
          kind: resolvedSelection.kind,
        });
        continue;
      }
      if (!clipboardItem || clipboardItem.kind !== "file") {
        continue;
      }
      const file = clipboardItem.getAsFile();
      if (file) {
        const resolvedSelection = await resolvePastedSelection({
          file,
          entryPath:
            "path" in file && typeof (file as File & { path?: unknown }).path === "string"
              ? String((file as File & { path?: string }).path)
              : undefined,
          entryName: file.name,
          transferPaths,
          fallbackKind: "file",
        });
        if (resolvedSelection.path) {
          contextSelections.push({
            path: resolvedSelection.path,
            name: file.name || resolvedSelection.path,
            kind: resolvedSelection.kind,
            imageUrl:
              resolvedSelection.kind === "file" &&
              (file.type.startsWith("image/") || looksLikeImagePath(resolvedSelection.path))
                ? await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.addEventListener(
                      "load",
                      () => {
                        if (typeof reader.result === "string") {
                          resolve(reader.result);
                          return;
                        }
                        reject(new Error("Unexpected file reader result type"));
                      },
                      { once: true },
                    );
                    reader.addEventListener(
                      "error",
                      () => {
                        reject(reader.error ?? new Error("Failed to read image"));
                      },
                      { once: true },
                    );
                    reader.readAsDataURL(file);
                  }).catch(() => undefined)
                : undefined,
          });
          continue;
        }
        files.push(file);
      }
    }
    if (contextSelections.length > 0) {
      console.log("[electron-chat] pasted context selections", contextSelections);
      appendContextSelections(contextSelections);
    }
    if (files.length === 0) {
      return;
    }
    const next: Attachment[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
              return;
            }
            reject(new Error("Unexpected file reader result type"));
          },
          { once: true },
        );
        reader.addEventListener(
          "error",
          () => {
            reject(reader.error ?? new Error("Failed to read image"));
          },
          { once: true },
        );
        reader.readAsDataURL(file);
      });
      if (!dataUrl) {
        continue;
      }
      next.push({
        id: nextId("att"),
        dataUrl,
        mimeType: file.type,
        name: file.name,
      });
    }
    if (next.length > 0) {
      console.log(
        "[electron-chat] image attachments added",
        next.map((entry) => ({ name: entry.name, mimeType: entry.mimeType })),
      );
      setSessionAttachments(currentSessionKey, (prev) => [...prev, ...next]);
    }
  }, [appendContextSelections, currentSessionKey, setSessionAttachments, subscriptionExpired]);

  const handleSelectContextPaths = useCallback(async () => {
    if (subscriptionExpired) {
      return;
    }
    try {
      const selected = await window.electronAPI.selectChatContextPaths();
      if (!Array.isArray(selected) || selected.length === 0) {
        return;
      }
      appendContextSelections(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [appendContextSelections, subscriptionExpired]);

  const runningTools = useMemo(
    () =>
      activeRunId
        ? timeline.filter(
            (item) =>
              item.kind === "tool" &&
              item.status === "running" &&
              item.runId === activeRunId,
          ).length
        : 0,
    [activeRunId, timeline],
  );

  const activeRunningToolId = useMemo(() => {
    let latest: ToolItem | null = null;
    for (const entry of timeline) {
      if (
        entry.kind !== "tool" ||
        entry.status !== "running" ||
        !activeRunId ||
        entry.runId !== activeRunId
      ) {
        continue;
      }
      if (!latest || entry.sortSeq > latest.sortSeq) {
        latest = entry;
      }
    }
    return latest?.id ?? null;
  }, [activeRunId, timeline]);

  const processedTimeline = useMemo(() => {
    const rawNodes: TimelineNode[] = timeline.map((item) => {
      if (item.kind === "text") {
        return {
          kind: "text",
          key: item.id,
          timestamp: item.timestamp,
          text: item.text,
          artifacts: item.artifacts,
          tone:
            item.role === "thinking"
              ? "thinking"
              : item.role === "system"
                ? "system"
                : item.role === "user"
                  ? "user"
                  : "assistant",
          streaming: item.streaming,
          final: item.final === true,
        };
      }
      if (item.kind === "error") {
        return {
          kind: "errorState",
          key: item.id,
          timestamp: item.timestamp,
          reason: item.reason,
          description: item.description,
          runId: item.runId,
        };
      }
      const display = resolveToolDisplay({ name: item.name, args: item.args });
      const detail = formatToolDetail(display);
      const summary = detail ? `${display.label}: ${detail}` : display.label;

      const detailText = [
        `Tool: ${display.label}`,
        detail ? `Detail: ${detail}` : null,
        item.args != null ? `Args:\n${JSON.stringify(item.args, null, 2)}` : null,
        item.output ? `Output:\n${item.output}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        kind: "tool",
        key: item.id,
        timestamp: item.timestamp,
        mergeKey: item.toolCallId,
        icon: display.icon,
        label: display.label,
        summary,
        detail: detailText,
        hasOutput: !!item.output,
        completed: item.status !== "running",
        running: item.status === "running",
      };
    });
    return collapseStreamingEvents(collapseProcessedTurn(rawNodes), 5, Boolean(activeRunId || sending));
  }, [activeRunId, sending, timeline]);

  const activeRunningToolKey = activeRunningToolId ? activeRunningToolId : null;
  const liveIndicatorLabel = compactingRunId
    ? "Compacting conversation"
    : reconnectStatus
      ? "Reconnect"
      : (sending || activeRunId) && runningTools === 0
        ? "Thinking"
        : null;
  const contextUsageLabel = useMemo(() => {
    if (sessionUsage.contextTokens == null) {
      return "Context left: ?";
    }
    return `Context left: ${formatTokenCount(sessionUsage.remainingTokens)} / ${formatTokenCount(sessionUsage.contextTokens)}`;
  }, [sessionUsage.contextTokens, sessionUsage.remainingTokens]);
  useEffect(() => {
    window.localStorage.setItem(CHAT_MODEL_LEVEL_STORAGE_KEY, modelLevel);
  }, [modelLevel]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-gray-900">
      <div className="sticky top-0 z-20 h-8 flex-none bg-white/80 backdrop-blur-sm [-webkit-app-region:drag]" />

      {error || connectionNotice ? (
        <div
          className={`mx-auto mt-4 w-full max-w-3xl rounded-2xl px-4 py-3 text-sm ${
            error != null || connectionNotice?.tone === "error"
              ? "border border-red-100 bg-red-50 text-red-600"
              : "border border-amber-100 bg-amber-50 text-amber-700"
          }`}
        >
          {error ?? connectionNotice?.message}
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <div ref={scrollRef} className="chat-page-timeline h-full">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-8" style={{ paddingBottom: composerAreaHeight + 16 }}>
            {!loading && timeline.length === 0 ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#1A162F] shadow-lg shadow-[#1A162F]/5">
                  <CurrentScenarioIcon size={28} weight="bold" />
                </div>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-[#1A162F]">
                  {currentScenarioLabel}
                </h1>
                <p className="max-w-[720px] text-base text-[#666F8D]">
                  {subscriptionExpired
                    ? "Renew your workspace plan to continue this workflow."
                    : "How can I help you today?"}
                </p>
              </div>
            ) : null}
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
                <div className="space-y-4">
                  <div className="flex justify-start">
                    <div className="w-full max-w-[70%] space-y-2 rounded-3xl bg-[#F6F7F9] px-5 py-4">
                      <Skeleton className="h-4 w-28 rounded-md" />
                      <Skeleton className="h-4 w-full rounded-md" />
                      <Skeleton className="h-4 w-3/4 rounded-md" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="w-full max-w-[62%] space-y-2 rounded-3xl bg-[#F6F7F9] px-5 py-4">
                      <Skeleton className="h-4 w-20 rounded-md" />
                      <Skeleton className="h-4 w-full rounded-md" />
                    </div>
                  </div>
                    <div className="flex justify-start">
                    <div className="w-full max-w-[76%] space-y-2 rounded-3xl bg-[#F6F7F9] px-5 py-4">
                      <Skeleton className="h-4 w-24 rounded-md" />
                      <Skeleton className="h-4 w-full rounded-md" />
                      <Skeleton className="h-4 w-5/6 rounded-md" />
                      <Skeleton className="h-4 w-2/3 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <ChatTimeline
              timeline={processedTimeline}
              activeRunningToolKey={activeRunningToolKey}
              liveIndicatorLabel={liveIndicatorLabel}
              liveIndicatorVisible={liveIndicatorLabel !== null}
              onRetryRun={handleRetryRun}
              onPreviewImage={setPreviewImage}
            />
          </div>
        </div>

        {showScrollBottom ? (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute left-1/2 z-30 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-text-main shadow-md transition-all duration-300 hover:border-gray-300 hover:bg-gray-50"
            style={{ bottom: composerAreaHeight + 16 }}
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={14} weight="bold" />
          </button>
        ) : null}

        <div ref={composerAreaRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="h-8 bg-gradient-to-t from-white via-white/80 to-transparent" />
          <div className="border-t border-white/40 bg-white px-6 pb-8 pointer-events-auto">
            <div className="mx-auto w-full max-w-3xl">
              {subscriptionExpired ? (
                <div className="mb-3 rounded-2xl border border-[#ECECEC] bg-white p-4 shadow-[0_10px_24px_rgba(26,22,47,0.05)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#ECECEC] bg-white text-[#666F8D] shadow-sm">
                        <WarningCircle size={18} weight="bold" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-[#1A162F]">Your plan has expired</div>
                        <p className="text-sm text-[#666F8D]">
                          Renew to keep chatting with Bustly and continue follow-up tasks.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenPricing();
                      }}
                      className="shrink-0 rounded-xl bg-[#1A162F] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#27223F]"
                    >
                      {subscriptionActionText}
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className={`group relative rounded-[28px] border bg-white p-4 shadow-sm transition-all duration-300 ${
                  subscriptionExpired
                    ? "cursor-not-allowed border-[#ECECEC] bg-[#FAFAFA]"
                    : isDraggingFiles
                      ? "border-[#1A162F] bg-[#1A162F]/5 shadow-[0_18px_44px_rgba(26,22,47,0.08)] ring-1 ring-[#1A162F]"
                    : "border-gray-200 hover:border-gray-300 focus-within:border-gray-400 focus-within:shadow-md"
                }`}
                onDragOver={(event) => {
                  if (subscriptionExpired) {
                    return;
                  }
                  event.preventDefault();
                  setIsDraggingFiles(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    return;
                  }
                  setIsDraggingFiles(false);
                }}
                onDrop={(event) => {
                  if (subscriptionExpired) {
                    return;
                  }
                  event.preventDefault();
                  setIsDraggingFiles(false);
                  const source =
                    event.dataTransfer.items && event.dataTransfer.items.length > 0
                      ? event.dataTransfer.items
                      : event.dataTransfer.files;
                  if (!source || source.length === 0) {
                    return;
                  }
                  void handleAttachmentFiles(source, event.dataTransfer).catch((error) => {
                    console.error("[electron-chat] drop attachment handling failed", error);
                  });
                }}
              >
                {isDraggingFiles && !subscriptionExpired ? (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <div className="animate-in zoom-in-95 fade-in flex items-center gap-2 text-[#1A162F] duration-200">
                      <Paperclip size={20} weight="bold" />
                      <span className="text-base font-medium">Drop files here</span>
                    </div>
                  </div>
                ) : null}

                {attachments.length > 0 || contextPaths.length > 0 ? (
                  <div className={`relative z-10 mb-3 flex flex-wrap gap-2 transition-opacity duration-200 ${isDraggingFiles ? "opacity-20" : ""}`}>
                    {attachments.map((att) => (
                      <InputArtifactCard
                        key={att.id}
                        kind="image"
                        title={att.name}
                        subtitle={att.mimeType}
                        imageUrl={att.dataUrl}
                        onPreview={() => {
                          setPreviewImage(att.dataUrl);
                        }}
                        onRemove={() => {
                          setPreviewImage(null);
                          setSessionAttachments(currentSessionKey, (prev) => prev.filter((p) => p.id !== att.id));
                        }}
                      />
                    ))}
                    {contextPaths.map((entry) => (
                      <InputArtifactCard
                        key={entry.id}
                        kind={entry.kind}
                        title={entry.name}
                        subtitle={entry.path}
                        imageUrl={entry.imageUrl}
                        onPreview={
                          entry.imageUrl
                            ? () => {
                                setPreviewImage(entry.imageUrl ?? null);
                              }
                            : undefined
                        }
                        onRemove={() => {
                          setSessionContextPaths(currentSessionKey, (prev) => prev.filter((p) => p.id !== entry.id));
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                <div className={`relative z-10 transition-opacity duration-200 ${isDraggingFiles ? "opacity-20" : ""}`}>
                  <textarea
                    ref={composerRef}
                    rows={1}
                    value={draft}
                    disabled={!connected || sending || subscriptionExpired}
                    placeholder={
                      subscriptionExpired
                        ? "Renew your plan to continue..."
                        : connected
                          ? showPlaceholderTicker
                            ? ""
                            : "Ask for follow-up changes..."
                          : "Connect to gateway to chat..."
                    }
                    className="min-h-[44px] max-h-[200px] w-full resize-none border-none bg-transparent px-1 py-1 pr-14 text-base font-normal leading-6 text-text-main outline-none placeholder:text-text-sub/70 disabled:cursor-not-allowed disabled:text-[#8B93AA]"
                    onChange={(e) => setSessionDraft(currentSessionKey, e.target.value)}
                    onCompositionStart={() => {
                      composerIsComposingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                      composerIsComposingRef.current = false;
                    }}
                    onKeyDown={(e) => {
                      const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
                      const isComposing =
                        composerIsComposingRef.current ||
                        nativeEvent.isComposing === true ||
                        nativeEvent.keyCode === 229;
                      if (isComposing) {
                        return;
                      }
                      if (!canSendMessage) {
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    onPaste={(e) => {
                      const files = e.clipboardData.files;
                      const items = e.clipboardData.items;
                      const source = files && files.length > 0 ? files : items;
                      if (!source || source.length === 0) {
                        return;
                      }
                      void handleAttachmentFiles(source, e.clipboardData).catch((error) => {
                        console.error("[electron-chat] paste attachment handling failed", error);
                      });
                    }}
                  />

                  {showPlaceholderTicker ? <PlaceholderTicker items={COMPOSER_PLACEHOLDERS} /> : null}
                </div>

                {activeRunId ? (
                  <div className="absolute right-3 bottom-3 z-20">
                    <PortalTooltip content="Stop">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17152F] text-white shadow-[0_8px_18px_rgba(23,21,47,0.18)] transition-transform duration-150 hover:scale-[1.02] active:scale-95"
                        onClick={handleAbort}
                        aria-label="Stop"
                      >
                        <Stop size={14} weight="fill" />
                      </button>
                    </PortalTooltip>
                  </div>
                ) : null}

                <div className="mt-1 flex items-center justify-between pt-2">
                  <div className={`flex items-center gap-2 ${subscriptionExpired ? "pointer-events-none opacity-50" : ""}`}>
                    <PortalTooltip content="Add photos & files">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-sub transition-all duration-200 hover:bg-gray-100 hover:text-text-main active:bg-gray-200"
                        onClick={() => {
                          void handleSelectContextPaths();
                        }}
                      >
                        <Paperclip size={18} weight="bold" />
                      </button>
                    </PortalTooltip>
                    <ChatModelPicker<ChatModelLevelId>
                      value={modelLevel}
                      options={CHAT_MODEL_LEVELS}
                      onChange={setModelLevel}
                      disabled={subscriptionExpired}
                    />
                  </div>

                  {activeRunId ? (
                    <div className="h-7 w-7" aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      className={`flex h-7 w-7 items-center justify-center rounded-lg shadow-sm transition-all active:scale-95 ${
                        canSendMessage
                          ? "bg-black text-white hover:bg-black/90 hover:shadow-md"
                          : "cursor-not-allowed bg-gray-100 text-gray-300"
                      }`}
                      disabled={!canSendMessage}
                      onClick={() => {
                        void handleSend();
                      }}
                    >
                      <ArrowUp size={14} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewImage
        ? createPortal(
            <div
              className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm [-webkit-app-region:no-drag]"
              onClick={() => setPreviewImage(null)}
            >
              <button
                type="button"
                className="fixed top-6 right-6 z-[30010] cursor-pointer rounded-full bg-black/50 p-2 text-white transition-all hover:bg-black/70 [-webkit-app-region:no-drag]"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPreviewImage(null);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewImage(null);
                }}
              >
                <X size={20} weight="bold" />
              </button>
              <div
                className="relative flex w-full max-w-[90vw] flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  ref={previewViewportRef}
                  className="max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{ msOverflowStyle: "none" }}
                  onWheel={(event) => {
                    if (!event.ctrlKey && !event.metaKey) {
                      return;
                    }
                    event.preventDefault();
                    if (event.deltaY === 0) {
                      return;
                    }
                    previewWheelDeltaRef.current += event.deltaY;
                    if (Math.abs(previewWheelDeltaRef.current) < PREVIEW_ZOOM_WHEEL_THRESHOLD) {
                      return;
                    }
                    const now = Date.now();
                    if (now - previewWheelLastStepAtRef.current < PREVIEW_ZOOM_STEP_THROTTLE_MS) {
                      return;
                    }
                    const direction = previewWheelDeltaRef.current < 0 ? "in" : "out";
                    previewWheelDeltaRef.current = 0;
                    previewWheelLastStepAtRef.current = now;
                    setPreviewZoom((value) => {
                      const zoomChoices = resolvePreviewZoomChoices(previewMinZoom);
                      if (direction === "in") {
                        return zoomChoices.find((step) => step > value + 0.001) ?? zoomChoices[zoomChoices.length - 1] ?? value;
                      }
                      for (let index = zoomChoices.length - 1; index >= 0; index -= 1) {
                        const step = zoomChoices[index];
                        if (step < value - 0.001) {
                          return step;
                        }
                      }
                      return zoomChoices[0] ?? value;
                    });
                  }}
                >
                  <img
                    ref={previewImageRef}
                    src={previewImage}
                    alt="Preview"
                    className="mx-auto block"
                    onLoad={() => {
                      const viewport = previewViewportRef.current;
                      const image = previewImageRef.current;
                      if (!viewport || !image || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
                        return;
                      }
                      const minZoom = resolvePreviewMinZoom(
                        viewport.clientWidth,
                        viewport.clientHeight,
                        image.naturalWidth,
                        image.naturalHeight,
                      );
                      setPreviewMinZoom(minZoom);
                      setPreviewZoom(minZoom);
                    }}
                    style={{
                      width: `${Math.round(previewZoom * 100)}%`,
                      maxWidth: "100%",
                      height: "auto",
                    }}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
