import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowsClockwise,
  Buildings,
  Coffee,
  MagnifyingGlass,
  PencilSimpleLine,
  Robot,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { buildBustlyWorkspaceAgentId, buildBustlyWorkspaceMainSessionKey } from "../../../shared/bustly-agent";
import { listWorkspaceSummaries } from "../../lib/bustly-supabase";
import { GatewayBrowserClient, type GatewayEventFrame } from "../../lib/gateway-client";
import { listAgentScenarioSessions, readCustomSessionLabels } from "../../lib/session-directory";
import { SIDEBAR_TASKS_REFRESH_EVENT } from "../../lib/session-events";
import { buildChatRoute, resolveSessionIconComponent } from "../../lib/session-icons";
import { useAppState } from "../../providers/AppStateProvider";
import Skeleton from "../ui/Skeleton";

type StudioAreaId = "breakroom" | "writing" | "research" | "working" | "syncing" | "error";

type AgentStatus = {
  area: StudioAreaId;
  label: string;
  tone: string;
};

type StudioAgent = {
  key: string;
  label: string;
  icon?: string;
  updatedAt: number | null;
  status: AgentStatus;
};

const IDLE_STATUS: AgentStatus = {
  area: "breakroom",
  label: "Idle",
  tone: "border-white/80 bg-white/85 text-[#5C657F]",
};

const AREA_META: Array<{
  id: StudioAreaId;
  title: string;
  subtitle: string;
  icon: typeof Coffee;
  shellClassName: string;
  floorClassName: string;
  emptyLabel: string;
}> = [
  {
    id: "breakroom",
    title: "Idle lounge",
    subtitle: "Waiting for the next assignment",
    icon: Coffee,
    shellClassName: "border-[#E7D9BA] bg-[linear-gradient(180deg,#FFF8EB_0%,#F6EFE2_100%)]",
    floorClassName: "bg-[linear-gradient(135deg,rgba(240,208,146,0.18)_25%,transparent_25%,transparent_50%,rgba(240,208,146,0.18)_50%,rgba(240,208,146,0.18)_75%,transparent_75%,transparent)] bg-[length:18px_18px]",
    emptyLabel: "No agents are cooling down.",
  },
  {
    id: "writing",
    title: "Writing desks",
    subtitle: "Assistant output in progress",
    icon: PencilSimpleLine,
    shellClassName: "border-[#D8E1FB] bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF3FF_100%)]",
    floorClassName: "bg-[radial-gradient(circle_at_1px_1px,rgba(113,143,217,0.20)_1px,transparent_0)] [background-size:16px_16px]",
    emptyLabel: "No agents are drafting replies.",
  },
  {
    id: "research",
    title: "Research pit",
    subtitle: "Thinking and reasoning streams",
    icon: MagnifyingGlass,
    shellClassName: "border-[#DDEBDD] bg-[linear-gradient(180deg,#F7FFF7_0%,#EDF8EF_100%)]",
    floorClassName: "bg-[linear-gradient(135deg,rgba(133,188,138,0.16)_25%,transparent_25%,transparent_50%,rgba(133,188,138,0.16)_50%,rgba(133,188,138,0.16)_75%,transparent_75%,transparent)] bg-[length:20px_20px]",
    emptyLabel: "No agents are researching.",
  },
  {
    id: "working",
    title: "Execution floor",
    subtitle: "Tool calls and active work",
    icon: Wrench,
    shellClassName: "border-[#E9D9F5] bg-[linear-gradient(180deg,#FCF8FF_0%,#F5EEFB_100%)]",
    floorClassName: "bg-[radial-gradient(circle_at_1px_1px,rgba(167,120,208,0.16)_1px,transparent_0)] [background-size:14px_14px]",
    emptyLabel: "No agents are executing tools.",
  },
  {
    id: "syncing",
    title: "Sync station",
    subtitle: "Reconnects and compaction",
    icon: ArrowsClockwise,
    shellClassName: "border-[#D8E7F0] bg-[linear-gradient(180deg,#F4FBFF_0%,#EAF4FA_100%)]",
    floorClassName: "bg-[linear-gradient(90deg,rgba(98,153,180,0.12)_1px,transparent_1px),linear-gradient(rgba(98,153,180,0.12)_1px,transparent_1px)] [background-size:18px_18px]",
    emptyLabel: "No agents are syncing.",
  },
  {
    id: "error",
    title: "Recovery bay",
    subtitle: "Runs that need attention",
    icon: WarningCircle,
    shellClassName: "border-[#F1CACA] bg-[linear-gradient(180deg,#FFF7F7_0%,#FCECEC_100%)]",
    floorClassName: "bg-[linear-gradient(135deg,rgba(211,113,113,0.16)_25%,transparent_25%,transparent_50%,rgba(211,113,113,0.16)_50%,rgba(211,113,113,0.16)_75%,transparent_75%,transparent)] bg-[length:16px_16px]",
    emptyLabel: "No agents are blocked.",
  },
];

function resolveLiveStatus(event: GatewayEventFrame): { sessionKey: string; status: AgentStatus } | null {
  if (event.event === "chat") {
    const payload = event.payload as {
      state?: string;
      sessionKey?: string;
      errorMessage?: string;
    };
    const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : "";
    if (!sessionKey) {
      return null;
    }
    if (payload.state === "final" || payload.state === "aborted") {
      return { sessionKey, status: IDLE_STATUS };
    }
    if (payload.state === "error") {
      return {
        sessionKey,
        status: {
          area: "error",
          label: payload.errorMessage ? "Run failed" : "Error",
          tone: "border-[#F2C8C8] bg-[#FFF2F2] text-[#A33A3A]",
        },
      };
    }
    return null;
  }

  if (event.event !== "agent") {
    return null;
  }

  const payload = event.payload as {
    stream?: string;
    sessionKey?: string;
    data?: Record<string, unknown>;
  };
  const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : "";
  if (!sessionKey) {
    return null;
  }

  const stream = typeof payload.stream === "string" ? payload.stream : "";
  const data = payload.data ?? {};

  if (stream === "thinking") {
    return {
      sessionKey,
      status: { area: "research", label: "Researching", tone: "border-[#CFE8D1] bg-[#F1FBF1] text-[#376446]" },
    };
  }
  if (stream === "assistant") {
    return {
      sessionKey,
      status: { area: "writing", label: "Writing", tone: "border-[#CDD9F8] bg-[#F2F6FF] text-[#355C9A]" },
    };
  }
  if (stream === "tool") {
    return {
      sessionKey,
      status: { area: "working", label: "Working", tone: "border-[#E0CEF0] bg-[#F8F1FF] text-[#774B98]" },
    };
  }
  if (stream === "compaction") {
    return {
      sessionKey,
      status: { area: "syncing", label: "Syncing", tone: "border-[#CCE5EF] bg-[#EEF8FC] text-[#2B687F]" },
    };
  }
  if (stream === "lifecycle") {
    const phase = typeof data.phase === "string" ? data.phase : "";
    if (phase === "reconnecting") {
      return {
        sessionKey,
        status: { area: "syncing", label: "Reconnecting", tone: "border-[#CCE5EF] bg-[#EEF8FC] text-[#2B687F]" },
      };
    }
    if (phase === "error") {
      return {
        sessionKey,
        status: { area: "error", label: "Error", tone: "border-[#F2C8C8] bg-[#FFF2F2] text-[#A33A3A]" },
      };
    }
    if (phase === "final" || phase === "aborted") {
      return { sessionKey, status: IDLE_STATUS };
    }
  }
  if (stream === "error") {
    return {
      sessionKey,
      status: { area: "error", label: "Error", tone: "border-[#F2C8C8] bg-[#FFF2F2] text-[#A33A3A]" },
    };
  }
  return null;
}

export default function StudioPage() {
  const navigate = useNavigate();
  const { checking, gatewayReady, initialized } = useAppState();
  const [agents, setAgents] = useState<StudioAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [workspaceId, setWorkspaceId] = useState("");
  const statusBySessionRef = useRef<Record<string, AgentStatus>>({});

  const activeAgentId = useMemo(() => buildBustlyWorkspaceAgentId(workspaceId), [workspaceId]);
  const activeMainSessionKey = useMemo(() => buildBustlyWorkspaceMainSessionKey(workspaceId), [workspaceId]);

  const refreshWorkspace = useCallback(async () => {
    try {
      const [userInfo, summary] = await Promise.all([
        window.electronAPI.bustlyGetUserInfo().catch(() => null),
        listWorkspaceSummaries().catch(() => ({ workspaces: [], activeWorkspaceId: "" })),
      ]);
      const nextWorkspaceId = summary.activeWorkspaceId || userInfo?.workspaceId || "";
      const activeWorkspace = summary.workspaces.find((workspace) => workspace.id === nextWorkspaceId);
      setWorkspaceId(nextWorkspaceId);
      setWorkspaceName(activeWorkspace?.name || "Workspace");
    } catch {
      setWorkspaceId("");
      setWorkspaceName("Workspace");
    }
  }, []);

  useEffect(() => {
    void refreshWorkspace();
    const unsubscribe = window.electronAPI.onBustlyLoginRefresh(() => {
      void refreshWorkspace();
    });
    return () => {
      unsubscribe();
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (checking || !initialized) {
      return;
    }
    if (!workspaceId || !gatewayReady) {
      setLoading(false);
      return;
    }

    let disposed = false;
    let client: GatewayBrowserClient | null = null;

    const loadSessions = async () => {
      if (!client) {
        return;
      }
      try {
        const sessions = await listAgentScenarioSessions({
          client,
          agentId: activeAgentId,
          customSessionLabels: readCustomSessionLabels(),
          limit: 50,
        });
        if (disposed) {
          return;
        }
        setAgents(
          sessions.map((session) => ({
            key: session.key,
            label: session.displayLabel,
            icon: session.icon,
            updatedAt: session.updatedAt,
            status: statusBySessionRef.current[session.key] ?? IDLE_STATUS,
          })),
        );
      } catch {
        if (!disposed) {
          setAgents([]);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    const connect = async () => {
      try {
        const status = await window.electronAPI.gatewayStatus();
        if (!status.running) {
          setLoading(false);
          return;
        }
        const connectConfig = await window.electronAPI.gatewayConnectConfig();
        if (!connectConfig.token || !connectConfig.wsUrl) {
          setLoading(false);
          return;
        }

        client = new GatewayBrowserClient({
          url: connectConfig.wsUrl,
          token: connectConfig.token ?? undefined,
          clientName: "openclaw-control-ui",
          mode: "webchat",
          instanceId: `bustly-electron-studio-${Date.now()}`,
          onHello: () => {
            setConnected(true);
            void loadSessions();
          },
          onClose: () => {
            if (!disposed) {
              setConnected(false);
            }
          },
          onEvent: (event) => {
            const next = resolveLiveStatus(event);
            if (!next) {
              return;
            }
            statusBySessionRef.current[next.sessionKey] = next.status;
            // Event frames can land before the initial session query, so cache the latest status by session key.
            setAgents((current) =>
              current.map((agent) => (agent.key === next.sessionKey ? { ...agent, status: next.status } : agent)),
            );
          },
        });
        client.start();
      } catch {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    void connect();

    const handleRefresh = () => {
      void loadSessions();
    };
    window.addEventListener(SIDEBAR_TASKS_REFRESH_EVENT, handleRefresh);

    return () => {
      disposed = true;
      window.removeEventListener(SIDEBAR_TASKS_REFRESH_EVENT, handleRefresh);
      client?.stop();
    };
  }, [activeAgentId, checking, gatewayReady, initialized, workspaceId]);

  const groupedAreas = useMemo(() => {
    const grouped = new Map<StudioAreaId, StudioAgent[]>();
    for (const area of AREA_META) {
      grouped.set(area.id, []);
    }
    for (const agent of agents) {
      grouped.get(agent.status.area)?.push(agent);
    }
    return grouped;
  }, [agents]);

  return (
    <div className="h-full overflow-y-auto bg-[linear-gradient(180deg,#EFF3F8_0%,#F7F9FC_28%,#F2F4F8_100%)] text-[#1A162F]">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-7 lg:px-10">
        <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,253,0.92)_100%)] p-6 shadow-[0_24px_70px_rgba(26,22,47,0.10)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-b-[28px] bg-[radial-gradient(circle_at_top,rgba(126,168,221,0.18),transparent_70%)]" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE5F0] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#666F8D]">
                  <Buildings size={14} weight="bold" />
                  Multi-agent studio
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1A162F] sm:text-[2.2rem]">
                    {workspaceName} office floor
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#666F8D] sm:text-[15px]">
                    Every scenario in this workspace is shown as an active agent. Live gateway streams move agents between lounge, research, writing, execution, sync, and recovery zones.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E5EAF2] bg-white/88 px-4 py-3 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A93B2]">Agents</div>
                  <div className="mt-2 text-2xl font-semibold text-[#1A162F]">{agents.length}</div>
                </div>
                <div className="rounded-2xl border border-[#E5EAF2] bg-white/88 px-4 py-3 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A93B2]">Main scenario</div>
                  <div className="mt-2 truncate text-sm font-semibold text-[#1A162F]">{activeMainSessionKey.replace(/^agent:/, "")}</div>
                </div>
                <div className="rounded-2xl border border-[#E5EAF2] bg-white/88 px-4 py-3 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8A93B2]">Gateway</div>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#1A162F]">
                    <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[#58B26B]" : "bg-[#D2A25B]"}`} />
                    {connected ? "Live" : "Connecting"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#E4EAF3] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF3F8_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-5">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1.2fr_1fr]">
                {AREA_META.map((area) => {
                  const areaAgents = groupedAreas.get(area.id) ?? [];
                  const AreaIcon = area.icon;
                  const panelHeight = area.id === "error" ? "min-h-[220px]" : "min-h-[250px]";

                  return (
                    <section
                      key={area.id}
                      className={`relative overflow-hidden rounded-[26px] border p-4 shadow-[0_12px_32px_rgba(26,22,47,0.08)] ${area.shellClassName} ${panelHeight}`}
                    >
                      <div className={`absolute inset-x-3 bottom-3 top-16 rounded-[22px] border border-white/60 ${area.floorClassName}`} />
                      <div className="relative flex h-full flex-col">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-[#1A162F]">{area.title}</div>
                            <div className="mt-1 text-xs leading-5 text-[#666F8D]">{area.subtitle}</div>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-[#1A162F] shadow-sm">
                            <AreaIcon size={18} weight="bold" />
                          </div>
                        </div>

                        <div className="relative flex flex-1 flex-col gap-3 pt-2">
                          {loading ? (
                            <>
                              <Skeleton className="h-[82px] rounded-[22px]" />
                              <Skeleton className="h-[82px] rounded-[22px]" />
                            </>
                          ) : areaAgents.length > 0 ? (
                            areaAgents.map((agent) => {
                              const SessionIcon = resolveSessionIconComponent({
                                icon: agent.icon,
                                label: agent.label,
                                sessionKey: agent.key,
                              });

                              return (
                                <button
                                  key={agent.key}
                                  type="button"
                                  onClick={() => {
                                    void navigate(buildChatRoute({ sessionKey: agent.key, label: agent.label, icon: agent.icon }));
                                  }}
                                  className="group relative flex items-start gap-3 rounded-[22px] border border-white/75 bg-white/88 p-3 text-left shadow-[0_10px_26px_rgba(26,22,47,0.10)] transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white"
                                >
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#E4EAF3] bg-[#F6F8FB] text-[#1A162F]">
                                    <SessionIcon size={20} weight="bold" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-[#1A162F]">{agent.label}</div>
                                    <div className="mt-1 truncate text-xs text-[#7B84A2]">{agent.key === activeMainSessionKey ? "Main workspace scenario" : agent.key}</div>
                                    <div className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${agent.status.tone}`}>
                                      {agent.status.label}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="flex flex-1 items-center justify-center rounded-[22px] border border-dashed border-white/70 bg-white/40 px-4 text-center text-sm leading-6 text-[#7A849F]">
                              {area.emptyLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[#666F8D]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E4EAF3] bg-white/80 px-3 py-1.5">
                <Robot size={14} weight="bold" />
                Click any agent to jump into its scenario chat.
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E4EAF3] bg-white/80 px-3 py-1.5">
                <ArrowsClockwise size={14} weight="bold" />
                Status comes from the shared gateway event stream.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
