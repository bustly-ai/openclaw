import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveModel } from "../agents/pi-embedded-runner/model.js";
import type { OpenClawConfig } from "../config/types.js";
import { loadSessionStore, updateSessionStore } from "../config/sessions.js";
import { resolveDefaultSessionStorePath } from "../config/sessions/paths.js";

const { supabaseCallsRef } = vi.hoisted(() => ({
  supabaseCallsRef: { current: [] as Array<{ path?: string; body?: unknown }> },
}));

vi.mock("../agents/pi-embedded-runner/model.js", () => ({
  resolveModel: vi.fn(() => ({ model: null })),
}));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => null),
}));

vi.mock("./supabase.js", () => ({
  bustlySupabaseFetch: vi.fn(async (params: unknown) => {
    const request = (params ?? {}) as { path?: string; body?: unknown };
    supabaseCallsRef.current.push({
      path: request.path,
      body: request.body,
    });
    return new Response("", { status: 201 });
  }),
}));

import { scheduleBustlySessionTitleGeneration } from "./session-title.js";

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for async condition.");
}

describe("session-title fallback upsert", () => {
  let tempRoot = "";
  let previousStateDir: string | undefined;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), "openclaw-session-title-"));
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = path.join(tempRoot, "state");
    supabaseCallsRef.current = [];
  });

  afterEach(() => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    rmSync(tempRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("upserts prompt excerpt as session_name when title generation fails", async () => {
    const workspaceId = "workspace-1";
    const agentId = "bustly-workspace-1-overview";
    const sessionKey = "agent:bustly-workspace-1-overview:conversation:session-1";
    const sessionId = "session-1";
    const seedLabel = "Daily pulse";
    const promptExcerpt = "用户输入原文 fallback title";
    const onLabelUpdated = vi.fn();

    const storePath = resolveDefaultSessionStorePath(agentId);
    await updateSessionStore(storePath, (store) => {
      store[sessionKey] = {
        sessionId,
        updatedAt: Date.now(),
        label: seedLabel,
      };
    });

    scheduleBustlySessionTitleGeneration({
      workspaceId,
      agentId,
      sessionKey,
      sessionId,
      seedLabel,
      promptExcerpt,
      sampleRouteKey: "chat.advanced",
      cfg: { providers: [] } as OpenClawConfig,
      onLabelUpdated,
    });

    await waitFor(() => supabaseCallsRef.current.length > 0);

    expect(onLabelUpdated).not.toHaveBeenCalled();
    expect(resolveModel).toHaveBeenCalledWith(
      expect.any(String),
      "chat.standard",
      undefined,
      expect.any(Object),
    );
    expect(supabaseCallsRef.current).toHaveLength(1);
    const request = supabaseCallsRef.current[0];
    expect(request?.path).toContain("workspace_session_name_extracts");
    const payload = JSON.parse(String(request?.body)) as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      workspace_id: workspaceId,
      session_id: sessionId,
      session_name: promptExcerpt,
      sample_route_key: "chat.advanced",
      prompt_excerpt: promptExcerpt,
    });

    const sessionStore = loadSessionStore(storePath, { skipCache: true });
    expect(sessionStore[sessionKey]?.label).toBe(seedLabel);
  });
});
