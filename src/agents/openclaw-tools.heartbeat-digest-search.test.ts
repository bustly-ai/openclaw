import { describe, expect, it } from "vitest";
import "./test-helpers/fast-core-tools.js";
import { createOpenClawTools } from "./openclaw-tools.js";

describe("openclaw tools heartbeat digest search", () => {
  it("omits heartbeat_digest_search in non-heartbeat runs", () => {
    const tools = createOpenClawTools({
      agentDir: "/tmp/openclaw-agent",
      isHeartbeat: false,
    });
    expect(tools.some((tool) => tool.name === "heartbeat_digest_search")).toBe(false);
  });

  it("includes heartbeat_digest_search only in heartbeat runs", () => {
    const tools = createOpenClawTools({
      agentDir: "/tmp/openclaw-agent",
      isHeartbeat: true,
    });
    expect(tools.some((tool) => tool.name === "heartbeat_digest_search")).toBe(true);
  });
});
