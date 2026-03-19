import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowsClockwise, Buildings, Lightning, Robot, WarningCircle } from "@phosphor-icons/react";
import { buildBustlyWorkspaceAgentId, buildBustlyWorkspaceMainSessionKey } from "../../../shared/bustly-agent";
import { listWorkspaceSummaries } from "../../lib/bustly-supabase";
import { GatewayBrowserClient, type GatewayEventFrame } from "../../lib/gateway-client";
import { listAgentScenarioSessions, readCustomSessionLabels } from "../../lib/session-directory";
import { SIDEBAR_TASKS_REFRESH_EVENT } from "../../lib/session-events";
import { buildChatRoute, resolveSessionIconComponent } from "../../lib/session-icons";
import { useAppState } from "../../providers/AppStateProvider";
import Skeleton from "../ui/Skeleton";
import officeBg from "../../assets/star-office/office_bg_small.webp";
import deskImage from "../../assets/star-office/desk-v3.webp";
import sofaImage from "../../assets/star-office/sofa-idle-v3.png";
import plantsSheet from "../../assets/star-office/plants-spritesheet.webp";
import postersSheet from "../../assets/star-office/posters-spritesheet.webp";
import coffeeMachineSheet from "../../assets/star-office/coffee-machine-v3-grid.webp";
import serverroomSheet from "../../assets/star-office/serverroom-spritesheet.webp";
import errorBugSheet from "../../assets/star-office/error-bug-spritesheet-grid.webp";
import syncSheet from "../../assets/star-office/sync-animation-v3-grid.webp";
import starWorkingSheet from "../../assets/star-office/star-working-spritesheet-grid.webp";
import flowersSheet from "../../assets/star-office/flowers-bloom-v2.webp";
import catsSheet from "../../assets/star-office/cats-spritesheet.webp";
import guestRole1 from "../../assets/star-office/guest_role_1.png";
import guestRole2 from "../../assets/star-office/guest_role_2.png";
import guestRole3 from "../../assets/star-office/guest_role_3.png";
import guestRole4 from "../../assets/star-office/guest_role_4.png";
import guestRole5 from "../../assets/star-office/guest_role_5.png";
import guestRole6 from "../../assets/star-office/guest_role_6.png";
import starOfficeFont from "../../assets/star-office/fonts/ark-pixel-12px-proportional-latin.ttf.woff2";

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

type ScenePoint = {
  x: number;
  y: number;
};

const PIXEL_FONT_FAMILY = '"StarOfficePixel", monospace';
const GUEST_ROLE_IMAGES = [guestRole1, guestRole2, guestRole3, guestRole4, guestRole5, guestRole6];

const IDLE_STATUS: AgentStatus = {
  area: "breakroom",
  label: "Idle",
  tone: "border-[#E6D9BB] bg-[#FFF8EC] text-[#75593D]",
};

const AREA_LABELS: Record<StudioAreaId, string> = {
  breakroom: "BREAKROOM",
  writing: "WRITING",
  research: "RESEARCH",
  working: "EXECUTION",
  syncing: "SYNC",
  error: "RECOVERY",
};

const AREA_SLOT_POSITIONS: Record<StudioAreaId, ScenePoint[]> = {
  breakroom: [
    { x: 612, y: 212 },
    { x: 665, y: 194 },
    { x: 718, y: 214 },
    { x: 577, y: 244 },
    { x: 655, y: 244 },
    { x: 733, y: 246 },
    { x: 604, y: 284 },
    { x: 697, y: 284 },
  ],
  writing: [
    { x: 258, y: 372 },
    { x: 298, y: 348 },
    { x: 342, y: 372 },
    { x: 246, y: 418 },
    { x: 301, y: 422 },
    { x: 357, y: 420 },
    { x: 279, y: 464 },
    { x: 334, y: 462 },
  ],
  research: [
    { x: 162, y: 182 },
    { x: 260, y: 154 },
    { x: 350, y: 187 },
    { x: 198, y: 242 },
    { x: 307, y: 242 },
    { x: 240, y: 288 },
    { x: 364, y: 286 },
    { x: 143, y: 292 },
  ],
  working: [
    { x: 568, y: 520 },
    { x: 634, y: 498 },
    { x: 702, y: 522 },
    { x: 770, y: 498 },
    { x: 540, y: 584 },
    { x: 624, y: 590 },
    { x: 715, y: 586 },
    { x: 800, y: 582 },
  ],
  syncing: [
    { x: 1038, y: 574 },
    { x: 1094, y: 545 },
    { x: 1152, y: 574 },
    { x: 1210, y: 545 },
    { x: 1068, y: 624 },
    { x: 1138, y: 628 },
    { x: 1202, y: 620 },
    { x: 992, y: 620 },
  ],
  error: [
    { x: 962, y: 196 },
    { x: 1014, y: 172 },
    { x: 1070, y: 196 },
    { x: 1126, y: 174 },
    { x: 952, y: 252 },
    { x: 1014, y: 242 },
    { x: 1088, y: 248 },
    { x: 1152, y: 242 },
  ],
};

const STATUS_RING_CLASS: Record<StudioAreaId, string> = {
  breakroom: "ring-[#D8B987]/45",
  writing: "ring-[#97B4F5]/55",
  research: "ring-[#9CCF9B]/55",
  working: "ring-[#E4AE63]/55",
  syncing: "ring-[#93D2E2]/60",
  error: "ring-[#EA8A8A]/60",
};

const SCENE_LABEL_POSITIONS: Array<{ area: StudioAreaId; point: ScenePoint }> = [
  { area: "research", point: { x: 238, y: 112 } },
  { area: "breakroom", point: { x: 662, y: 118 } },
  { area: "error", point: { x: 1068, y: 116 } },
  { area: "writing", point: { x: 284, y: 510 } },
  { area: "working", point: { x: 674, y: 646 } },
  { area: "syncing", point: { x: 1126, y: 654 } },
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
      status: { area: "working", label: "Working", tone: "border-[#F2D5A3] bg-[#FFF6E7] text-[#8A5A22]" },
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

function spriteBackgroundStyle({
  sheet,
  width,
  height,
  sheetWidth,
  sheetHeight,
  frame = 0,
  columns = 1,
  scale = 1,
}: {
  sheet: string;
  width: number;
  height: number;
  sheetWidth: number;
  sheetHeight: number;
  frame?: number;
  columns?: number;
  scale?: number;
}): CSSProperties {
  const x = (frame % columns) * width;
  const y = Math.floor(frame / columns) * height;
  return {
    width: `${width * scale}px`,
    height: `${height * scale}px`,
    backgroundImage: `url(${sheet})`,
    backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`,
    backgroundPosition: `-${x * scale}px -${y * scale}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

function assignGuestRoleImage(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return GUEST_ROLE_IMAGES[hash % GUEST_ROLE_IMAGES.length];
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
    for (const areaId of Object.keys(AREA_SLOT_POSITIONS) as StudioAreaId[]) {
      grouped.set(areaId, []);
    }
    for (const agent of agents) {
      grouped.get(agent.status.area)?.push(agent);
    }
    return grouped;
  }, [agents]);

  const sceneAgents = useMemo(
    () =>
      (Object.keys(AREA_SLOT_POSITIONS) as StudioAreaId[]).flatMap((areaId) => {
        const areaAgents = groupedAreas.get(areaId) ?? [];
        const slots = AREA_SLOT_POSITIONS[areaId];
        return areaAgents.map((agent, index) => ({
          agent,
          point: slots[index % slots.length],
          areaId,
        }));
      }),
    [groupedAreas],
  );

  const activeAreaCounts = useMemo(
    () =>
      (Object.keys(AREA_SLOT_POSITIONS) as StudioAreaId[]).map((areaId) => ({
        areaId,
        count: groupedAreas.get(areaId)?.length ?? 0,
      })),
    [groupedAreas],
  );

  const hasActiveDeskScene = (groupedAreas.get("writing")?.length ?? 0) + (groupedAreas.get("research")?.length ?? 0) > 0;
  const hasErrorScene = (groupedAreas.get("error")?.length ?? 0) > 0;
  const hasSyncScene = (groupedAreas.get("syncing")?.length ?? 0) > 0;
  const hasServerGlow = agents.some((agent) => agent.status.area !== "breakroom");

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,#EEF5FF_0%,#E8EFF8_42%,#DFE6F0_100%)] text-[#1A162F]">
      <style>{`
        @font-face {
          font-family: "StarOfficePixel";
          src: url("${starOfficeFont}") format("woff2");
          font-display: swap;
        }

        @keyframes studioFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }

        @keyframes studioPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(0.96); opacity: 0.88; }
          50% { transform: translate(-50%, -50%) scale(1.04); opacity: 1; }
        }
      `}</style>

      <div className="mx-auto flex min-h-full w-full max-w-[1520px] flex-col gap-4 px-5 py-5 sm:px-7 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/82 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#666F8D] shadow-sm">
              <Buildings size={14} weight="bold" />
              Studio
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/82 px-3 py-1.5 text-xs font-semibold text-[#1A162F] shadow-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[#58B26B]" : "bg-[#D2A25B]"}`} />
              {connected ? "Gateway live" : "Gateway connecting"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#666F8D]">
            <span className="rounded-full border border-white/70 bg-white/82 px-3 py-1.5 shadow-sm">{agents.length} agents</span>
            <span className="rounded-full border border-white/70 bg-white/82 px-3 py-1.5 shadow-sm">
              Main: {activeMainSessionKey.replace(/^agent:/, "")}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(245,247,251,0.84)_100%)] p-2 shadow-[0_28px_80px_rgba(26,22,47,0.14)] sm:p-3">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(119,151,202,0.26),transparent_68%)]" />

          <div className="relative overflow-hidden rounded-[28px] border border-[#C9D6E4] bg-[#D7E2EE] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div
              className="relative h-[720px] w-full overflow-hidden lg:h-[760px] xl:h-[820px]"
              style={{
                backgroundColor: "#D7E2EE",
                backgroundImage: `url(${officeBg})`,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 100%",
                imageRendering: "pixelated",
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,16,27,0.05)_0%,transparent_26%,transparent_74%,rgba(7,12,20,0.18)_100%)]" />

                <div
                  className="pointer-events-none absolute"
                  style={{ left: "17.2%", top: "57.9%", width: "21.56%", transform: "translate(-50%, -50%)" }}
                >
                  <img src={deskImage} alt="" className="h-auto w-full" style={{ imageRendering: "pixelated" }} />
                </div>

                <div
                  className="pointer-events-none absolute"
                  style={{ left: "52.4%", top: "20%", width: "20%", transform: "translate(-50%, -50%)" }}
                >
                  <img src={sofaImage} alt="" className="h-auto w-full opacity-95" style={{ imageRendering: "pixelated" }} />
                </div>

                <div className="pointer-events-none absolute" style={{ left: "44.3%", top: "55.1%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: coffeeMachineSheet,
                      width: 230,
                      height: 230,
                      sheetWidth: 2760,
                      sheetHeight: 1840,
                      scale: 0.8,
                    })}
                  />
                </div>

                <div className="pointer-events-none absolute" style={{ left: "79.8%", top: "19.7%", transform: "translate(-50%, -50%)" }}>
                  <div
                    className={hasServerGlow ? "brightness-[1.08] saturate-110" : "opacity-80"}
                    style={spriteBackgroundStyle({
                      sheet: serverroomSheet,
                      width: 180,
                      height: 251,
                      sheetWidth: 7200,
                      sheetHeight: 251,
                      scale: 1,
                    })}
                  />
                </div>

                <div className="pointer-events-none absolute" style={{ left: "7.3%", top: "77.4%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: catsSheet,
                      width: 160,
                      height: 160,
                      sheetWidth: 640,
                      sheetHeight: 640,
                      columns: 4,
                      frame: 7,
                      scale: 0.78,
                    })}
                  />
                </div>

                <div className="pointer-events-none absolute" style={{ left: "24.2%", top: "54.2%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: flowersSheet,
                      width: 128,
                      height: 128,
                      sheetWidth: 512,
                      sheetHeight: 512,
                      columns: 4,
                      frame: 10,
                      scale: 0.5,
                    })}
                  />
                </div>

                <div className="pointer-events-none absolute" style={{ left: "19.7%", top: "9.2%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: postersSheet,
                      width: 160,
                      height: 160,
                      sheetWidth: 640,
                      sheetHeight: 1280,
                      columns: 4,
                      frame: 0,
                      scale: 0.9,
                    })}
                  />
                </div>

                <div className="pointer-events-none absolute" style={{ left: "44.1%", top: "24.7%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: plantsSheet,
                      width: 160,
                      height: 160,
                      sheetWidth: 640,
                      sheetHeight: 640,
                      columns: 4,
                      frame: 13,
                      scale: 0.82,
                    })}
                  />
                </div>
                <div className="pointer-events-none absolute" style={{ left: "18%", top: "25.7%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: plantsSheet,
                      width: 160,
                      height: 160,
                      sheetWidth: 640,
                      sheetHeight: 640,
                      columns: 4,
                      frame: 9,
                      scale: 0.82,
                    })}
                  />
                </div>
                <div className="pointer-events-none absolute" style={{ left: "76.3%", top: "68.8%", transform: "translate(-50%, -50%)" }}>
                  <div
                    style={spriteBackgroundStyle({
                      sheet: plantsSheet,
                      width: 160,
                      height: 160,
                      sheetWidth: 640,
                      sheetHeight: 640,
                      columns: 4,
                      frame: 1,
                      scale: 0.82,
                    })}
                  />
                </div>

                {hasActiveDeskScene ? (
                  <div className="pointer-events-none absolute" style={{ left: "17.4%", top: "46.2%", transform: "translate(-50%, -50%)" }}>
                    <div
                      className="drop-shadow-[0_14px_20px_rgba(0,0,0,0.2)]"
                      style={spriteBackgroundStyle({
                        sheet: starWorkingSheet,
                        width: 230,
                        height: 144,
                        sheetWidth: 2400,
                        sheetHeight: 1500,
                        scale: 1.14,
                      })}
                    />
                  </div>
                ) : null}

                {hasErrorScene ? (
                  <div className="pointer-events-none absolute animate-[studioFloat_2.6s_ease-in-out_infinite]" style={{ left: "79.7%", top: "30.7%", transform: "translate(-50%, -50%)" }}>
                    <div
                      className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.18)]"
                      style={spriteBackgroundStyle({
                        sheet: errorBugSheet,
                        width: 180,
                        height: 180,
                        sheetWidth: 1760,
                        sheetHeight: 1980,
                        scale: 0.82,
                      })}
                    />
                  </div>
                ) : null}

                {hasSyncScene ? (
                  <div className="pointer-events-none absolute animate-[studioPulse_1.9s_steps(2,end)_infinite]" style={{ left: "90.4%", top: "82.2%", transform: "translate(-50%, -50%)" }}>
                    <div
                      className="drop-shadow-[0_8px_16px_rgba(121,213,232,0.35)]"
                      style={spriteBackgroundStyle({
                        sheet: syncSheet,
                        width: 256,
                        height: 256,
                        sheetWidth: 1792,
                        sheetHeight: 1792,
                        scale: 0.62,
                      })}
                    />
                  </div>
                ) : null}

                {SCENE_LABEL_POSITIONS.map(({ area, point }) => (
                  <div
                    key={area}
                    className="pointer-events-none absolute rounded-[10px] border border-[#4B3424] bg-[#6C4A2F]/90 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#F8D98B] shadow-[0_4px_0_rgba(55,33,17,0.55)]"
                    style={{
                      left: `${(point.x / 1280) * 100}%`,
                      top: `${(point.y / 720) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      fontFamily: PIXEL_FONT_FAMILY,
                    }}
                  >
                    {AREA_LABELS[area]}
                  </div>
                ))}

                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[rgba(235,242,250,0.52)] backdrop-blur-[2px]">
                    <div className="w-[min(420px,68%)] space-y-3 rounded-[24px] border border-white/80 bg-white/72 p-5 shadow-[0_18px_46px_rgba(26,22,47,0.18)]">
                      <Skeleton className="h-6 w-1/2 rounded-full" />
                      <Skeleton className="h-20 rounded-[18px]" />
                      <Skeleton className="h-20 rounded-[18px]" />
                    </div>
                  </div>
                ) : null}

                {sceneAgents.map(({ agent, point, areaId }) => {
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
                      className="group absolute flex -translate-x-1/2 -translate-y-1/2 items-start gap-2 text-left"
                      style={{ left: `${(point.x / 1280) * 100}%`, top: `${(point.y / 720) * 100}%` }}
                    >
                      <div
                        className={`relative overflow-hidden rounded-[18px] border border-white/85 bg-white/82 p-1.5 shadow-[0_14px_30px_rgba(20,15,38,0.22)] backdrop-blur-[5px] ring-2 transition-transform duration-150 group-hover:-translate-y-1 ${STATUS_RING_CLASS[areaId]}`}
                      >
                        <img
                          src={assignGuestRoleImage(agent.key)}
                          alt=""
                          className="h-10 w-10 rounded-[12px] object-cover"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#1A162F] text-white shadow-sm">
                          <SessionIcon size={11} weight="bold" />
                        </div>
                      </div>

                      <div className="max-w-[188px] rounded-[18px] border border-white/80 bg-[rgba(255,251,243,0.9)] px-3 py-2 shadow-[0_14px_30px_rgba(20,15,38,0.2)] backdrop-blur-[5px]">
                        <div className="truncate text-[13px] font-semibold leading-4 text-[#1A162F]">{agent.label}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] leading-4 text-[#6A6F84]">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${agent.status.tone}`}>
                            {agent.status.label}
                          </span>
                          {agent.key === activeMainSessionKey ? <span className="text-[#6F58A8]">Main</span> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}

                <div className="pointer-events-none absolute left-4 top-4 rounded-[16px] border border-white/75 bg-[rgba(248,250,255,0.82)] px-4 py-3 shadow-[0_14px_34px_rgba(26,22,47,0.14)] backdrop-blur-[5px]">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#7B84A2]" style={{ fontFamily: PIXEL_FONT_FAMILY }}>
                    STAR OFFICE
                  </div>
                  <div className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-[#1A162F]">{workspaceName}</div>
                  <div className="mt-1 max-w-[280px] text-xs leading-5 text-[#666F8D]">
                    Live scenarios drift between lounge, research, writing, execution, sync, and recovery zones.
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[18px] border border-[#4B3424] bg-[#68462C]/92 px-4 py-2 text-[12px] text-[#F6D68B] shadow-[0_6px_0_rgba(55,33,17,0.45)]">
                  <Robot size={14} weight="bold" />
                  <span style={{ fontFamily: PIXEL_FONT_FAMILY }}>CLICK AN AGENT TO OPEN ITS SCENARIO CHAT</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeAreaCounts.map(({ areaId, count }) => (
              <div
                key={areaId}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#43506B] shadow-sm"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${areaId === "error" ? "bg-[#D86A6A]" : areaId === "syncing" ? "bg-[#69BCD5]" : areaId === "working" ? "bg-[#D8A25A]" : areaId === "research" ? "bg-[#71B373]" : areaId === "writing" ? "bg-[#6C94E3]" : "bg-[#C39A60]"}`} />
                {AREA_LABELS[areaId]} {count}
              </div>
            ))}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#43506B] shadow-sm">
              <ArrowsClockwise size={14} weight="bold" />
              Shared gateway events drive the placements
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#43506B] shadow-sm">
              {hasErrorScene ? <WarningCircle size={14} weight="bold" /> : <Lightning size={14} weight="bold" />}
              Scene art ported from Star-Office-UI for this experiment
            </div>
          </div>
        </div>
      </div>
  );
}
