import { describe, expect, it } from "vitest";
import { listGatewayMethods } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";

const BUSTLY_METHODS = [
  "bustly.supabase.get-config",
  "bustly.agents.list",
  "bustly.agents.create",
  "bustly.agents.update",
  "bustly.agents.delete",
  "bustly.sessions.list",
  "bustly.sessions.create",
  "bustly.links.resolve",
  "bustly.runtime.health",
  "bustly.runtime.report-issue",
  "bustly.runtime.manifest.apply",
  "bustly.workspace.get-active",
  "bustly.workspace.set-active",
] as const;

const OAUTH_METHODS = [
  "oauth.login",
  "oauth.poll",
  "oauth.cancel",
  "oauth.is-logged-in",
  "oauth.get-user-info",
  "oauth.logout",
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

  it("includes oauth methods and registers their handlers", () => {
    const methods = listGatewayMethods();
    for (const method of OAUTH_METHODS) {
      expect(methods.filter((entry) => entry === method)).toHaveLength(1);
      expect(typeof coreGatewayHandlers[method]).toBe("function");
    }
  });
});
