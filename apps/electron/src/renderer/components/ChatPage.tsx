import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GatewayBrowserClient, type GatewayEventFrame } from "../../../../../ui/src/ui/gateway.ts";
import { extractText, extractThinking } from "../../../../../ui/src/ui/chat/message-extract.ts";

type ChatRole = "user" | "assistant" | "thinking" | "system";

type Attachment = {
  id: string;
  dataUrl: string;
  mimeType: string;
  name: string;
};

type TextItem = {
  kind: "text";
  id: string;
  sortSeq: number;
  timestamp: number;
  role: ChatRole;
  text: string;
  runId?: string;
  streaming?: boolean;
};

type ToolStatus = "running" | "completed" | "error";

type ToolItem = {
  kind: "tool";
  id: string;
  toolCallId: string;
  sortSeq: number;
  timestamp: number;
  name: string;
  args: unknown;
  output?: string;
  status: ToolStatus;
};

type TimelineItem = TextItem | ToolItem;

const DEFAULT_SESSION_KEY = "agent:main:main";
const TOOL_RUNNING_MIN_VISIBLE_MS = 600;

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
    return String(value);
  }
}

function parseDataUrl(dataUrl: string): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
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

function roleLabel(role: ChatRole): string {
  if (role === "assistant") {
    return "Assistant";
  }
  if (role === "thinking") {
    return "Thinking";
  }
  if (role === "system") {
    return "System";
  }
  return "You";
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

function parseToolBlocks(message: unknown): Array<{ toolCallId: string; name: string; args: unknown; output?: string }> {
  if (!message || typeof message !== "object") {
    return [];
  }
  const rec = message as Record<string, unknown>;
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
        args: existing?.args ?? {},
        output,
      });
    }
  }
  return [...calls.values()];
}

export default function ChatPage() {
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [streamUpdatedAt, setStreamUpdatedAt] = useState<number | null>(null);
  const [thinkingUpdatedAt, setThinkingUpdatedAt] = useState<number | null>(null);

  const clientRef = useRef<GatewayBrowserClient | null>(null);
  const seqCounterRef = useRef(1_000_000_000);
  const toolTimersRef = useRef<Map<string, number>>(new Map());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadGatewayStatus = useCallback(async () => {
    const status = await window.electronAPI.gatewayStatus();
    setGateway(status);
    return status;
  }, []);

  const appendOrUpdateText = useCallback((params: {
    key: string;
    role: ChatRole;
    runId?: string;
    seq: number;
    text?: string;
    delta?: string;
    timestamp?: number;
    streaming?: boolean;
  }) => {
    setTimeline((prev) => {
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
          runId: params.runId,
          streaming: params.streaming,
        };
        return [...prev, next].sort(compareTimeline);
      }
      const current = prev[idx] as TextItem;
      const nextText = normalizeTextDelta(current.text, params.text, params.delta);
      if (nextText === current.text && current.streaming === params.streaming) {
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...current,
        text: nextText,
        sortSeq: Math.min(current.sortSeq, params.seq),
        streaming: params.streaming,
      };
      return next;
    });
  }, []);

  const markRunFinished = useCallback((runId: string | null) => {
    if (!runId) {
      return;
    }
    setTimeline((prev) =>
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
  }, []);

  const upsertTool = useCallback((params: {
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
    const applyCompletion = (status: ToolStatus, output?: string) => {
      setTimeline((prev) => {
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

    setTimeline((prev) => {
      const idx = prev.findIndex((item) => item.kind === "tool" && item.id === key);
      if (idx === -1) {
        const created: ToolItem = {
          kind: "tool",
          id: key,
          toolCallId: params.toolCallId,
          sortSeq: params.seq,
          timestamp: params.timestamp,
          name: params.name,
          args: params.args ?? {},
          output: params.output,
          status: params.phase === "result" ? (params.isError ? "error" : "completed") : "running",
        };
        return [...prev, created].sort(compareTimeline);
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
        name: params.name || current.name,
        args: params.phase === "start" ? params.args ?? current.args : current.args,
        output: params.phase === "result" ? (params.output ?? current.output) : current.output,
        sortSeq: Math.min(current.sortSeq, params.seq),
        status: nextStatus,
      };
      return next;
    });

    if (params.phase === "result") {
      const timerMap = toolTimersRef.current;
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
      setTimeline((prev) => {
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
          window.clearTimeout(timerMap.get(key)!);
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
  }, []);

  const loadHistory = useCallback(async (client: GatewayBrowserClient) => {
    const res = await client.request<{ messages?: unknown[] }>("chat.history", {
      sessionKey: DEFAULT_SESSION_KEY,
      limit: 200,
    });
    const history = Array.isArray(res.messages) ? res.messages : [];
    const items: TimelineItem[] = [];
    let fallbackSeq = 1;

    for (const message of history) {
      if (!message || typeof message !== "object") {
        continue;
      }
      const rec = message as Record<string, unknown>;
      const role = typeof rec.role === "string" ? rec.role.toLowerCase() : "";
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
          id: nextId("history-thinking"),
          sortSeq: baseSeq,
          timestamp,
          role: "thinking",
          text: thinking,
          streaming: false,
        });
      }

      const text = readContentText(message);
      if (text) {
        const textRole: ChatRole =
          role === "user"
            ? "user"
            : role === "assistant"
              ? "assistant"
              : role === "system"
                ? "system"
                : "assistant";
        items.push({
          kind: "text",
          id: nextId("history-text"),
          sortSeq: baseSeq + 0.01,
          timestamp,
          role: textRole,
          text,
          streaming: false,
        });
      }

      const tools = parseToolBlocks(message);
      for (const tool of tools) {
        items.push({
          kind: "tool",
          id: `tool:${tool.toolCallId}:${nextId("h")}`,
          toolCallId: tool.toolCallId,
          sortSeq: baseSeq + 0.02,
          timestamp,
          name: tool.name,
          args: tool.args,
          output: tool.output,
          status: tool.output ? "completed" : "running",
        });
      }
    }

    setTimeline(items.sort(compareTimeline));
  }, []);

  const connectGateway = useCallback(
    async (status: GatewayStatus) => {
      if (!status.running) {
        setConnected(false);
        return;
      }
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
        clientName: "openclaw-control-ui",
        mode: "webchat",
        instanceId: `bustly-electron-chat-${Date.now()}`,
        onHello: () => {
          setConnected(true);
          setError(null);
          void loadHistory(client).catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        },
        onClose: ({ code, reason, error: closeError }) => {
          setConnected(false);
          const message = closeError?.message || `disconnected (${code}): ${reason || "no reason"}`;
          setError(message);
        },
        onEvent: (evt: GatewayEventFrame) => {
          if (evt.event === "agent") {
            const payload = evt.payload as {
              runId?: string;
              seq?: number;
              stream?: string;
              ts?: number;
              sessionKey?: string;
              data?: Record<string, unknown>;
            };
            if (!payload || payload.sessionKey !== DEFAULT_SESSION_KEY) {
              return;
            }
            const runId = typeof payload.runId === "string" ? payload.runId : null;
            const seq = typeof payload.seq === "number" ? payload.seq : seqCounterRef.current++;
            const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
            const stream = typeof payload.stream === "string" ? payload.stream : "";
            const data = payload.data ?? {};

            if (runId) {
              setActiveRunId(runId);
            }

            if (stream === "assistant") {
              appendOrUpdateText({
                key: `run:${runId ?? "unknown"}:assistant`,
                role: "assistant",
                runId: runId ?? undefined,
                seq,
                text: typeof data.text === "string" ? data.text : undefined,
                delta: typeof data.delta === "string" ? data.delta : undefined,
                timestamp: ts,
                streaming: true,
              });
              setStreamUpdatedAt(Date.now());
              return;
            }

            if (stream === "thinking") {
              appendOrUpdateText({
                key: `run:${runId ?? "unknown"}:thinking`,
                role: "thinking",
                runId: runId ?? undefined,
                seq,
                text: typeof data.text === "string" ? data.text : undefined,
                delta: typeof data.delta === "string" ? data.delta : undefined,
                timestamp: ts,
                streaming: true,
              });
              setThinkingUpdatedAt(Date.now());
              return;
            }

            if (stream === "tool") {
              const phase =
                data.phase === "start" || data.phase === "update" || data.phase === "result"
                  ? data.phase
                  : "update";
              const toolCallId = typeof data.toolCallId === "string" ? data.toolCallId : "";
              if (!toolCallId) {
                return;
              }
              upsertTool({
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

            if (stream === "lifecycle") {
              const phase = typeof data.phase === "string" ? data.phase : "";
              if (phase === "end") {
                markRunFinished(runId);
                setActiveRunId((prev) => (prev === runId ? null : prev));
                const aborted = data.aborted === true;
                if (aborted) {
                  const stopReason = typeof data.stopReason === "string" ? data.stopReason : "aborted";
                  setTimeline((prev) => {
                    const next: TextItem = {
                      kind: "text",
                      id: nextId("aborted"),
                      sortSeq: seq,
                      timestamp: ts,
                      role: "system",
                      text: `Request aborted (${stopReason}).`,
                      runId: runId ?? undefined,
                      streaming: false,
                    };
                    return [...prev, next].sort(compareTimeline);
                  });
                }
              }
            }
            return;
          }

          if (evt.event === "chat") {
            const payload = evt.payload as {
              runId?: string;
              sessionKey?: string;
              state?: string;
              message?: unknown;
              errorMessage?: string;
            };
            if (!payload || payload.sessionKey !== DEFAULT_SESSION_KEY) {
              return;
            }
            const runId = typeof payload.runId === "string" ? payload.runId : null;
            if (payload.state === "final" && payload.message) {
              const text = readContentText(payload.message);
              if (text) {
                appendOrUpdateText({
                  key: `run:${runId ?? "unknown"}:assistant-final`,
                  role: "assistant",
                  runId: runId ?? undefined,
                  seq: seqCounterRef.current++,
                  text,
                  streaming: false,
                });
              }
              const thinking = readThinkingText(payload.message);
              if (thinking) {
                appendOrUpdateText({
                  key: `run:${runId ?? "unknown"}:thinking-final`,
                  role: "thinking",
                  runId: runId ?? undefined,
                  seq: seqCounterRef.current++,
                  text: thinking,
                  streaming: false,
                });
              }
              markRunFinished(runId);
              setActiveRunId((prev) => (prev === runId ? null : prev));
            }
            if (payload.state === "error") {
              setError(payload.errorMessage ?? "Chat error");
            }
          }
        },
      });
      clientRef.current?.stop();
      clientRef.current = client;
      client.start();
    },
    [appendOrUpdateText, loadHistory, markRunFinished, upsertTool],
  );

  useEffect(() => {
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
          setLoading(false);
        }
      }
    })();

    const interval = window.setInterval(() => {
      void loadGatewayStatus()
        .then((status) => {
          setGateway(status);
          if (!status.running) {
            setConnected(false);
          }
        })
        .catch(() => {});
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      clientRef.current?.stop();
      clientRef.current = null;
      for (const timer of toolTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      toolTimersRef.current.clear();
    };
  }, [connectGateway, loadGatewayStatus]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline]);

  const handleStartGateway = useCallback(async () => {
    setError(null);
    const result = await window.electronAPI.gatewayStart();
    if (!result.success) {
      setError(result.error ?? "Failed to start gateway");
      return;
    }
    const status = await loadGatewayStatus();
    await connectGateway(status);
  }, [connectGateway, loadGatewayStatus]);

  const handleSend = useCallback(async () => {
    const msg = draft.trim();
    if (!connected || (!msg && attachments.length === 0) || sending || !clientRef.current) {
      return;
    }

    const localSeq = seqCounterRef.current++;
    const userItem: TextItem = {
      kind: "text",
      id: nextId("user"),
      sortSeq: localSeq,
      timestamp: Date.now(),
      role: "user",
      text: draft,
      streaming: false,
    };
    setTimeline((prev) => [...prev, userItem].sort(compareTimeline));
    setDraft("");
    setAttachments([]);
    setSending(true);
    setError(null);

    const idempotencyKey = nextId("run");
    setActiveRunId(idempotencyKey);

    try {
      const apiAttachments = attachments
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
        sessionKey: DEFAULT_SESSION_KEY,
        message: msg,
        deliver: false,
        idempotencyKey,
        attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActiveRunId(null);
    } finally {
      setSending(false);
    }
  }, [attachments, connected, draft, sending]);

  const handleAbort = useCallback(async () => {
    if (!connected || !clientRef.current) {
      return;
    }
    try {
      await clientRef.current.request("chat.abort", {
        sessionKey: DEFAULT_SESSION_KEY,
        runId: activeRunId ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeRunId, connected]);

  const handleAttachmentFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
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
      setAttachments((prev) => [...prev, ...next]);
    }
  }, []);

  const runningTools = useMemo(
    () => timeline.filter((item) => item.kind === "tool" && item.status === "running").length,
    [timeline],
  );

  const hasRecentTextStream = useMemo(() => {
    if (!streamUpdatedAt) {
      return false;
    }
    return Date.now() - streamUpdatedAt < 700;
  }, [streamUpdatedAt, timeline.length]);

  const hasRecentThinkingStream = useMemo(() => {
    if (!thinkingUpdatedAt) {
      return false;
    }
    return Date.now() - thinkingUpdatedAt < 700;
  }, [thinkingUpdatedAt, timeline.length]);

  const showThinkingLive = Boolean(activeRunId && !hasRecentTextStream && runningTools === 0);

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Chat</h1>
            <p className="text-xs text-slate-500">
              Session: {DEFAULT_SESSION_KEY}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-1 font-medium ${
                connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
            <span className="text-slate-500">
              Port: {gateway?.port ?? "-"}
            </span>
            {!gateway?.running ? (
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  void handleStartGateway();
                }}
              >
                Start Gateway
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Loading chat history...
          </div>
        ) : null}

        <div className="space-y-3">
          {timeline.map((item) => {
            if (item.kind === "tool") {
              const summary = `${item.name}`;
              return (
                <details key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">
                    <span className={item.status === "running" ? "text-amber-700" : item.status === "error" ? "text-red-700" : "text-slate-700"}>
                      {item.status === "running" ? "Running" : "Completed"} {summary}
                    </span>
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-md bg-slate-950/95 p-3 text-xs text-slate-100">
{`Tool: ${item.name}\n\nArgs:\n${JSON.stringify(item.args ?? {}, null, 2)}\n\nOutput:\n${item.output ?? "(none)"}`}
                  </pre>
                </details>
              );
            }

            const isUser = item.role === "user";
            const isThinking = item.role === "thinking";
            return (
              <div key={item.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isUser
                      ? "bg-slate-900 text-white"
                      : isThinking
                        ? "border border-slate-200 bg-slate-100 text-slate-600"
                        : item.role === "system"
                          ? "border border-amber-200 bg-amber-50 text-amber-800"
                          : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <div className="mb-1 text-[11px] font-medium opacity-70">{roleLabel(item.role)}</div>
                  <div className="whitespace-pre-wrap break-words">{item.text}</div>
                  {item.streaming ? (
                    <div className="mt-1 text-[11px] opacity-60">streaming...</div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {showThinkingLive ? (
            <div className="flex justify-start">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                <span>Thinking...</span>
                <span className="absolute inset-y-0 -left-20 w-20 animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-slate-200/70 to-transparent" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        {attachments.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative">
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-2 -top-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-xs text-white"
                  onClick={() => {
                    setAttachments((prev) => prev.filter((entry) => entry.id !== att.id));
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Image
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleAttachmentFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={connected ? "Type your message..." : "Gateway not connected"}
            disabled={!connected || sending}
            className="max-h-44 min-h-[48px] flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900/10 placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100"
          />
          <div className="flex gap-2">
            {activeRunId ? (
              <button
                type="button"
                onClick={() => {
                  void handleAbort();
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Stop
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void handleSend();
              }}
              disabled={!connected || sending || (!draft.trim() && attachments.length === 0)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Send
            </button>
          </div>
        </div>
        {hasRecentThinkingStream ? (
          <div className="mt-2 text-xs text-slate-500">Thinking stream active</div>
        ) : null}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(420px); }
        }
      `}</style>
    </div>
  );
}
