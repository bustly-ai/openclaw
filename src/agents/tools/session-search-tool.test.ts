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
});
