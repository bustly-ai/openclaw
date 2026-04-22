import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { DEFAULT_HEARTBEAT_FILENAME } from "../../agents/workspace.js";
import {
  DEFAULT_BUSTLY_HEARTBEAT_EVERY,
  loadBustlyHeartbeatState,
  parseBustlyHeartbeatMarkdown,
  renderBustlyHeartbeatMarkdown,
  resolveBustlyHeartbeatStatePath,
  resolveBustlyHeartbeatHealthSummary,
  saveBustlyHeartbeatState,
  updateBustlyHeartbeatEventStatus as applyHeartbeatEventStatusUpdate,
  type BustlyHeartbeatEventRecord,
  type BustlyHeartbeatStatus,
} from "../../bustly/heartbeats.js";
import { readBustlyOAuthState } from "../../bustly-oauth.js";
import { findAgentEntryIndex, listAgentEntries } from "../../commands/agents.config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import {
  listActiveHeartbeatRuns,
  runHeartbeatOnce,
  setHeartbeatsEnabled,
} from "../../infra/heartbeat-runner.js";
import { listBustlyWorkspaceAgents } from "../../bustly/workspace-agents.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

type HeartbeatAgentSummary = ReturnType<typeof listBustlyWorkspaceAgents>[number];

const HEARTBEAT_PRIORITY_ORDER = {
  critical: 0,
  warning: 1,
  suggestion: 2,
} as const;

function resolveWorkspaceIdParam(params: Record<string, unknown>): string {
  const explicitWorkspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId.trim() : "";
  if (explicitWorkspaceId) {
    return explicitWorkspaceId;
  }
  return readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
}

function summarizeHeartbeatTitle(content: string, fallback: string): string {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#+\s*/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim() ?? "";
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 56 ? `${normalized.slice(0, 53).trimEnd()}...` : normalized;
}

function sortPriorityEvents(left: BustlyHeartbeatEventRecord, right: BustlyHeartbeatEventRecord): number {
  if (left.status !== right.status) {
    return left.status === "open" ? -1 : 1;
  }
  if (left.status === "open" && right.status === "open") {
    const severityDelta =
      HEARTBEAT_PRIORITY_ORDER[left.severity] - HEARTBEAT_PRIORITY_ORDER[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
  }
  return right.updatedAt - left.updatedAt;
}

function sortHeartbeatTimelineEvents(
  left: BustlyHeartbeatEventRecord,
  right: BustlyHeartbeatEventRecord,
): number {
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }
  return left.id.localeCompare(right.id);
}

async function readHeartbeatDefinition(agent: HeartbeatAgentSummary) {
  const filePath = path.join(agentWorkspaceDir(agent), DEFAULT_HEARTBEAT_FILENAME);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return {
      filePath,
      content,
      definition: parseBustlyHeartbeatMarkdown(content),
    };
  } catch {
    return {
      filePath,
      content: "",
      definition: null,
    };
  }
}

function agentWorkspaceDir(agent: HeartbeatAgentSummary): string {
  return resolveAgentWorkspaceDir(loadConfig(), agent.agentId);
}

function resolveAgentHeartbeatConfig(cfg: ReturnType<typeof loadConfig>, agentId: string) {
  const entry = listAgentEntries(cfg).find(
    (candidate) => normalizeAgentId(candidate.id) === normalizeAgentId(agentId),
  );
  return entry?.heartbeat;
}

function buildHeartbeatListItem(params: {
  workspaceId: string;
  agent: HeartbeatAgentSummary;
  content: string;
  state: ReturnType<typeof loadBustlyHeartbeatState>;
}) {
  const heartbeatConfig = resolveAgentHeartbeatConfig(loadConfig(), params.agent.agentId);
  const enabled = Boolean(heartbeatConfig);
  const openEvents = params.state.events
    .filter((event) => event.status === "open")
    .sort(sortPriorityEvents);
  const title = summarizeHeartbeatTitle(params.content, params.agent.name);

  return {
    agentId: params.agent.agentId,
    agentName: params.agent.name,
    title,
    content: params.content,
    enabled,
    createdAt: params.agent.createdAt,
    updatedAt: params.agent.updatedAt,
    lastScanAt: params.state.lastScanAt,
    every: heartbeatConfig?.every ?? (enabled ? DEFAULT_BUSTLY_HEARTBEAT_EVERY : null),
    openEvents,
  };
}

async function listWorkspaceHeartbeats(workspaceId: string) {
  const agents = listBustlyWorkspaceAgents({ workspaceId }).filter((agent) => !agent.isMain);
  const cards = [];
  let initialized = false;
  let hasEvents = false;
  for (const agent of agents) {
    const statePath = resolveBustlyHeartbeatStatePath({
      workspaceId,
      agentId: agent.agentId,
    });
    const hasStateJson = existsSync(statePath);
    if (hasStateJson) {
      initialized = true;
    }
    const heartbeatState = loadBustlyHeartbeatState({
      workspaceId,
      agentId: agent.agentId,
    });
    if (heartbeatState.events.length > 0) {
      hasEvents = true;
    }
    const { definition } = await readHeartbeatDefinition(agent);
    const heartbeatConfig = resolveAgentHeartbeatConfig(loadConfig(), agent.agentId);
    if (!definition && !heartbeatConfig && heartbeatState.events.length === 0) {
      continue;
    }
    const content = definition?.content?.trim() ?? "";
    cards.push(
      buildHeartbeatListItem({
        workspaceId,
        agent,
        content,
        state: heartbeatState,
      }),
    );
  }
  const priorityEvents = cards
    .flatMap((card) =>
      card.openEvents.map((event) => ({
        ...event,
        agentName: card.agentName,
      })),
    )
    .sort(sortPriorityEvents);
  const health = resolveBustlyHeartbeatHealthSummary({
    events: priorityEvents,
    lastScanAt:
      cards.reduce<number | null>(
        (latest, card) =>
          typeof card.lastScanAt === "number" && (latest === null || card.lastScanAt > latest)
            ? card.lastScanAt
            : latest,
        null,
      ) ?? null,
  });

  return {
    workspaceId,
    initialized,
    hasEvents,
    heartbeats: cards,
    priorityEvents,
    health,
  };
}

function listWorkspaceHeartbeatTimelineEvents(params: {
  workspaceId: string;
  agentId?: string;
}) {
  const normalizedAgentId = params.agentId ? normalizeAgentId(params.agentId) : "";
  const agents = listBustlyWorkspaceAgents({ workspaceId: params.workspaceId }).filter((agent) => !agent.isMain);
  const events = [];
  for (const agent of agents) {
    if (normalizedAgentId && normalizeAgentId(agent.agentId) !== normalizedAgentId) {
      continue;
    }
    const state = loadBustlyHeartbeatState({
      workspaceId: params.workspaceId,
      agentId: agent.agentId,
    });
    for (const event of state.events) {
      events.push({
        ...event,
        agentName: agent.name,
      });
    }
  }
  return events.sort(sortHeartbeatTimelineEvents);
}

function listWorkspaceRunningHeartbeats(workspaceId: string) {
  const workspaceAgentIds = new Set(
    listBustlyWorkspaceAgents({ workspaceId })
      .filter((agent) => !agent.isMain)
      .map((agent) => normalizeAgentId(agent.agentId)),
  );
  const runs = listActiveHeartbeatRuns()
    .filter((run) => workspaceAgentIds.has(normalizeAgentId(run.agentId)))
    .sort((left, right) => left.startedAt - right.startedAt);
  return {
    workspaceId,
    hasRunningHeartbeats: runs.length > 0,
    runs,
  };
}

function updateAgentHeartbeatConfig(params: {
  cfg: ReturnType<typeof loadConfig>;
  agentId: string;
  enabled: boolean;
}) {
  const list = listAgentEntries(params.cfg);
  const index = findAgentEntryIndex(list, params.agentId);
  if (index < 0) {
    throw new Error(`agent "${params.agentId}" not found`);
  }
  const current = list[index];
  const nextEntry = params.enabled
    ? {
        ...current,
        heartbeat: {
          ...(current.heartbeat ?? {}),
          every: current.heartbeat?.every ?? DEFAULT_BUSTLY_HEARTBEAT_EVERY,
          target: current.heartbeat?.target ?? "none",
        },
      }
    : (() => {
        const { heartbeat: _heartbeat, ...rest } = current;
        return rest;
      })();
  const nextList = [...list];
  nextList[index] = nextEntry;
  return {
    ...params.cfg,
    agents: {
      ...params.cfg.agents,
      list: nextList,
    },
  };
}

function resolveHeartbeatAgent(workspaceId: string, agentId: string): HeartbeatAgentSummary | null {
  const normalizedAgentId = normalizeAgentId(agentId);
  return (
    listBustlyWorkspaceAgents({ workspaceId }).find(
      (agent) => !agent.isMain && normalizeAgentId(agent.agentId) === normalizedAgentId,
    ) ?? null
  );
}

function isHeartbeatStatus(status: unknown): status is BustlyHeartbeatStatus {
  return status === "open" || status === "seen" || status === "actioned";
}

async function saveHeartbeatFile(params: {
  workspaceId: string;
  agent: HeartbeatAgentSummary;
  content: string;
}) {
  const workspaceDir = agentWorkspaceDir(params.agent);
  if (!workspaceDir) {
    throw new Error(`workspace not found for agent "${params.agent.agentId}"`);
  }
  await fs.mkdir(workspaceDir, { recursive: true });
  const filePath = path.join(workspaceDir, DEFAULT_HEARTBEAT_FILENAME);
  await fs.writeFile(
    filePath,
    renderBustlyHeartbeatMarkdown({
      content: params.content,
    }),
    "utf-8",
  );
}

async function saveHeartbeatDefinition(params: {
  workspaceId: string;
  agentId: string;
  content: string;
}) {
  const agent = resolveHeartbeatAgent(params.workspaceId, params.agentId);
  if (!agent) {
    throw new Error(`workspace heartbeat agent "${params.agentId}" not found`);
  }
  await saveHeartbeatFile({
    workspaceId: params.workspaceId,
    agent,
    content: params.content,
  });
  const cfg = updateAgentHeartbeatConfig({
    cfg: loadConfig(),
    agentId: agent.agentId,
    enabled: true,
  });
  await writeConfigFile(cfg);
  setHeartbeatsEnabled(true);
  const state = saveBustlyHeartbeatState({
    workspaceId: params.workspaceId,
    agentId: agent.agentId,
    state: loadBustlyHeartbeatState({
      workspaceId: params.workspaceId,
      agentId: agent.agentId,
    }),
  });
  return buildHeartbeatListItem({
    workspaceId: params.workspaceId,
    agent,
    content: params.content.trim(),
    state,
  });
}

async function deleteHeartbeatDefinition(params: {
  workspaceId: string;
  agentId: string;
}) {
  const agent = resolveHeartbeatAgent(params.workspaceId, params.agentId);
  if (!agent) {
    throw new Error(`workspace heartbeat agent "${params.agentId}" not found`);
  }
  const nextConfig = updateAgentHeartbeatConfig({
    cfg: loadConfig(),
    agentId: agent.agentId,
    enabled: false,
  });
  await writeConfigFile(nextConfig);
  const filePath = path.join(agentWorkspaceDir(agent), DEFAULT_HEARTBEAT_FILENAME);
  const statePath = resolveBustlyHeartbeatStatePath({
    workspaceId: params.workspaceId,
    agentId: agent.agentId,
  });
  await Promise.all([
    fs.rm(filePath, { force: true }).catch(() => undefined),
    fs.rm(statePath, { force: true }).catch(() => undefined),
  ]);
  return {
    ok: true,
    workspaceId: params.workspaceId,
    agentId: agent.agentId,
  };
}

function updateHeartbeatEventStatus(params: {
  workspaceId: string;
  agentId: string;
  eventId: string;
  status: BustlyHeartbeatStatus;
}) {
  const agent = resolveHeartbeatAgent(params.workspaceId, params.agentId);
  if (!agent) {
    throw new Error(`workspace heartbeat agent "${params.agentId}" not found`);
  }
  const currentState = loadBustlyHeartbeatState({
    workspaceId: params.workspaceId,
    agentId: agent.agentId,
  });
  const { state: nextState, event } = applyHeartbeatEventStatusUpdate({
    state: currentState,
    eventId: params.eventId,
    status: params.status,
  });
  if (!event) {
    return null;
  }
  saveBustlyHeartbeatState({
    workspaceId: params.workspaceId,
    agentId: agent.agentId,
    state: nextState,
  });
  return {
    ...event,
    agentName: agent.name,
  };
}

export const bustlyHeartbeatHandlers: GatewayRequestHandlers = {
  "bustly.heartbeats.list": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      if (!workspaceId) {
        respond(
          true,
          {
            workspaceId: "",
            initialized: false,
            hasEvents: false,
            heartbeats: [],
            priorityEvents: [],
            health: null,
          },
          undefined,
        );
        return;
      }
      respond(true, await listWorkspaceHeartbeats(workspaceId), undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.heartbeats.save": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const content = typeof params.content === "string" ? params.content.trim() : "";
      const legacyGoal = typeof params.goal === "string" ? params.goal.trim() : "";
      const legacyNotifyWhen =
        typeof params.notifyWhen === "string" ? params.notifyWhen.trim() : "";
      const resolvedContent =
        content || [legacyGoal, legacyNotifyWhen].filter(Boolean).join("\n\n");
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      if (!resolvedContent) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "content is required"));
        return;
      }
      const item = await saveHeartbeatDefinition({
        workspaceId,
        agentId,
        content: resolvedContent,
      });
      respond(true, item, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.heartbeats.toggle": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const enabled = params.enabled;
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      if (typeof enabled !== "boolean") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "enabled is required"));
        return;
      }
      const agent = resolveHeartbeatAgent(workspaceId, agentId);
      if (!agent) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "unknown heartbeat agent"),
        );
        return;
      }
      const nextConfig = updateAgentHeartbeatConfig({
        cfg: loadConfig(),
        agentId,
        enabled,
      });
      await writeConfigFile(nextConfig);
      if (enabled) {
        setHeartbeatsEnabled(true);
      }
      const { definition } = await readHeartbeatDefinition(agent);
      const state = loadBustlyHeartbeatState({
        workspaceId,
        agentId,
      });
      respond(
        true,
        buildHeartbeatListItem({
          workspaceId,
          agent,
          content: definition?.content?.trim() ?? "",
          state,
        }),
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.heartbeats.delete": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      respond(true, await deleteHeartbeatDefinition({ workspaceId, agentId }), undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.heartbeats.events.list": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      if (!workspaceId) {
        respond(true, { workspaceId: "", events: [] }, undefined);
        return;
      }
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const events = listWorkspaceHeartbeatTimelineEvents({ workspaceId, agentId });
      respond(true, { workspaceId, events }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.heartbeats.running": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      if (!workspaceId) {
        respond(
          true,
          { workspaceId: "", hasRunningHeartbeats: false, runs: [] },
          undefined,
        );
        return;
      }
      respond(true, listWorkspaceRunningHeartbeats(workspaceId), undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          err instanceof Error ? err.message : String(err),
        ),
      );
    }
  },
  "bustly.heartbeats.events.update-status": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
      const eventId = typeof params.eventId === "string" ? params.eventId.trim() : "";
      const status = params.status;
      if (!workspaceId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "workspaceId is required"),
        );
        return;
      }
      if (!agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
        return;
      }
      if (!eventId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "eventId is required"));
        return;
      }
      if (!isHeartbeatStatus(status)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "status must be one of: open, seen, actioned"),
        );
        return;
      }
      const updatedEvent = updateHeartbeatEventStatus({
        workspaceId,
        agentId,
        eventId,
        status,
      });
      if (!updatedEvent) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "heartbeat event not found"));
        return;
      }
      respond(true, { workspaceId, event: updatedEvent }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "bustly.heartbeats.scan": async ({ params, respond }) => {
    try {
      const workspaceId = resolveWorkspaceIdParam(params);
      if (!workspaceId) {
        respond(
          true,
          {
            workspaceId: "",
            initialized: false,
            hasEvents: false,
            runs: [],
            heartbeats: [],
            priorityEvents: [],
            health: null,
          },
          undefined,
        );
        return;
      }
      setHeartbeatsEnabled(true);
      const heartbeats = await listWorkspaceHeartbeats(workspaceId);
      const enabledHeartbeats = heartbeats.heartbeats.filter((item) => item.enabled);
      const runs = await Promise.all(
        enabledHeartbeats.map(async (heartbeat) => ({
          agentId: heartbeat.agentId,
          result: await runHeartbeatOnce({
            cfg: loadConfig(),
            agentId: heartbeat.agentId,
            reason: "wake",
            force: true,
          }),
        })),
      );
      respond(
        true,
        {
          runs,
          ...(await listWorkspaceHeartbeats(workspaceId)),
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
};
