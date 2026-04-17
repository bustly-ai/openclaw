import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionSearchTool } from "./session-search-tool.js";
import { withStateDirEnv } from "../../test-helpers/state-dir-env.js";

async function writeStoreAndTranscript(params: {
  stateDir: string;
  sessionKey: string;
  sessionId: string;
  updatedAt: number;
  messages: Array<Record<string, unknown>>;
}) {
  const sessionsDir = path.join(params.stateDir, "agents", "main", "sessions");
  await fs.mkdir(sessionsDir, { recursive: true });
  const storePath = path.join(sessionsDir, "sessions.json");
  let store: Record<string, unknown> = {};
  try {
    store = JSON.parse(await fs.readFile(storePath, "utf-8")) as Record<string, unknown>;
  } catch {
    store = {};
  }
  store[params.sessionKey] = {
    sessionId: params.sessionId,
    updatedAt: params.updatedAt,
  };
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
  const transcript = [
    JSON.stringify({
      type: "session",
      id: params.sessionId,
      version: 1,
      timestamp: new Date().toISOString(),
    }),
    ...params.messages.map((message) => JSON.stringify({ type: "message", message })),
  ].join("\n");
  await fs.writeFile(path.join(sessionsDir, `${params.sessionId}.jsonl`), `${transcript}\n`, "utf-8");
}

async function writeExperienceEntry(params: {
  stateDir: string;
  agentId: string;
  entry: Record<string, unknown>;
}) {
  const experienceDir = path.join(params.stateDir, "agents", params.agentId, "agent", "experience");
  await fs.mkdir(experienceDir, { recursive: true });
  const experienceFile = path.join(experienceDir, "entries.jsonl");
  await fs.appendFile(experienceFile, `${JSON.stringify(params.entry)}\n`, "utf-8");
}

describe("session_search", () => {
  it("searches prior session transcripts and skips the current session by default", async () => {
    await withStateDirEnv("openclaw-session-search-", async ({ stateDir }) => {
      await writeStoreAndTranscript({
        stateDir,
        sessionKey: "agent:main:main",
        sessionId: "sess-current",
        updatedAt: 10,
        messages: [{ role: "user", content: "current conversation about tiktok integration" }],
      });
      await writeStoreAndTranscript({
        stateDir,
        sessionKey: "agent:main:whatsapp:direct:henry",
        sessionId: "sess-old",
        updatedAt: 20,
        messages: [
          { role: "user", content: "Need tiktok integration via nango ads flow" },
          {
            role: "assistant",
            content: [{ type: "text", text: "Implemented ads connection and deploy flow." }],
          },
        ],
      });

      const tool = createSessionSearchTool({ agentSessionKey: "agent:main:main" });
      const result = await tool.execute("call-1", {
        query: "tiktok integration",
        maxResults: 3,
      });

      const details = result.details as {
        searchedSessions?: number;
        results?: Array<{ sessionKey?: string; snippet?: string }>;
      };
      expect(details.searchedSessions).toBe(1);
      expect(details.results?.[0]?.sessionKey).toBe("agent:main:whatsapp:direct:henry");
      expect(details.results?.[0]?.snippet?.toLowerCase()).toContain("tiktok integration");
    });
  });

  it("searches structured retrieval precedents before falling back to raw transcripts", async () => {
    await withStateDirEnv("openclaw-session-search-experience-", async ({ stateDir }) => {
      await writeStoreAndTranscript({
        stateDir,
        sessionKey: "agent:main:main",
        sessionId: "sess-current",
        updatedAt: 30,
        messages: [{ role: "user", content: "current conversation about shopify pagination" }],
      });
      await writeExperienceEntry({
        stateDir,
        agentId: "main",
        entry: {
          timestamp: "2026-04-14T10:00:00.000Z",
          layer: "retrieval_only",
          summary: "Shopify orders cap at 250 per page and require pagination.",
          reason: "first_seen_correction_precedent",
          query: "why only 250 orders pagination",
          sourceSessionId: "sess-old",
          sourceSessionKey: "agent:main:whatsapp:direct:henry",
          snippet: "The agent corrected the order analysis by paginating past the first 250 orders.",
          keywords: ["shopify", "orders", "pagination"],
        },
      });

      const tool = createSessionSearchTool({ agentSessionKey: "agent:main:main" });
      const result = await tool.execute("call-2", {
        query: "why only 250 orders pagination",
        maxResults: 3,
      });

      const details = result.details as {
        searchedSessions?: number;
        results?: Array<{ sessionKey?: string; role?: string; snippet?: string }>;
      };
      expect(details.results?.[0]?.sessionKey).toBe("agent:main:whatsapp:direct:henry");
      expect(details.results?.[0]?.role).toBe("experience");
      expect(details.results?.[0]?.snippet?.toLowerCase()).toContain("250");
    });
  });
});
