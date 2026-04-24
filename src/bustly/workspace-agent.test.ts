import { describe, expect, it } from "vitest";
import {
  resolveBustlyAgentNameFromAnyAgentId,
  resolveBustlyWorkspaceTokenFromAgentId,
} from "./workspace-agent.js";

describe("workspace-agent id parsing", () => {
  it("resolves workspace token and agent name from bustly workspace agent ids", () => {
    expect(resolveBustlyWorkspaceTokenFromAgentId("bustly-43e9866a-store-ops")).toBe("43e9866a");
    expect(resolveBustlyAgentNameFromAnyAgentId("bustly-43e9866a-store-ops")).toBe("store-ops");
  });

  it("treats legacy workspace main agent ids as overview", () => {
    expect(resolveBustlyWorkspaceTokenFromAgentId("bustly-43e9866a")).toBe("43e9866a");
    expect(resolveBustlyAgentNameFromAnyAgentId("bustly-43e9866a")).toBe("overview");
  });

  it("returns null for non-bustly or malformed agent ids", () => {
    expect(resolveBustlyWorkspaceTokenFromAgentId("main")).toBeNull();
    expect(resolveBustlyAgentNameFromAnyAgentId("main")).toBeNull();
    expect(resolveBustlyWorkspaceTokenFromAgentId("bustly-workspace-1-store-ops")).toBeNull();
    expect(resolveBustlyAgentNameFromAnyAgentId("bustly-workspace-1-store-ops")).toBeNull();
  });
});
