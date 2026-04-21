import { describe, expect, it } from "vitest";
import { listGatewayMethods } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";

const BUSTLY_METHODS = [
  "bustly.supabase.get-config",
  "bustly.agents.get-config",
  "bustly.agents.list",
  "bustly.agents.create",
  "bustly.agents.update",
  "bustly.agents.delete",
  "bustly.sessions.list",
  "bustly.sessions.create",
  "bustly.links.resolve",
  "bustly.path.resolve",
  "bustly.path.import",
  "bustly.runtime.health",
  "bustly.runtime.report-issue",
  "bustly.runtime.bootstrap",
  "bustly.runtime.manifest.apply",
  "bustly.tasks.status",
  "bustly.workspace.get-active",
  "bustly.workspace.set-active",
] as const;

describe("gateway method list bustly additions", () => {
  it("includes bustly methods exactly once", () => {
    const methods = listGatewayMethods();
    for (const method of BUSTLY_METHODS) {
      expect(methods.filter((entry) => entry === method)).toHaveLength(1);
    }
  });

  it("registers handlers for bustly methods in core handlers", () => {
    for (const method of BUSTLY_METHODS) {
      expect(typeof coreGatewayHandlers[method]).toBe("function");
    }
  });
});
