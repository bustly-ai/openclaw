import { describe, expect, it } from "vitest";
import {
  authorizeOperatorScopesForMethod,
  isGatewayMethodClassified,
  resolveLeastPrivilegeOperatorScopesForMethod,
  READ_SCOPE,
  WRITE_SCOPE,
} from "./method-scopes.js";

describe("bustly workspace method scopes", () => {
  it("classifies bustly.workspace.get-active as read", () => {
    expect(isGatewayMethodClassified("bustly.workspace.get-active")).toBe(true);
    expect(resolveLeastPrivilegeOperatorScopesForMethod("bustly.workspace.get-active")).toEqual([
      READ_SCOPE,
    ]);
    expect(authorizeOperatorScopesForMethod("bustly.workspace.get-active", [READ_SCOPE])).toEqual({
      allowed: true,
    });
    expect(authorizeOperatorScopesForMethod("bustly.workspace.get-active", [WRITE_SCOPE])).toEqual({
      allowed: true,
    });
  });

  it("classifies bustly.workspace.set-active as write", () => {
    expect(isGatewayMethodClassified("bustly.workspace.set-active")).toBe(true);
    expect(resolveLeastPrivilegeOperatorScopesForMethod("bustly.workspace.set-active")).toEqual([
      WRITE_SCOPE,
    ]);
    expect(authorizeOperatorScopesForMethod("bustly.workspace.set-active", [READ_SCOPE])).toEqual({
      allowed: false,
      missingScope: WRITE_SCOPE,
    });
    expect(authorizeOperatorScopesForMethod("bustly.workspace.set-active", [WRITE_SCOPE])).toEqual({
      allowed: true,
    });
  });

  it("classifies bustly read methods as read", () => {
    for (const method of [
      "bustly.agents.list",
      "bustly.sessions.list",
      "bustly.supabase.get-config",
      "bustly.links.resolve",
      "bustly.runtime.health",
    ]) {
      expect(isGatewayMethodClassified(method)).toBe(true);
      expect(resolveLeastPrivilegeOperatorScopesForMethod(method)).toEqual([READ_SCOPE]);
      expect(authorizeOperatorScopesForMethod(method, [READ_SCOPE])).toEqual({
        allowed: true,
      });
    }
  });

  it("classifies bustly agent/session mutations as write", () => {
    for (const method of [
      "bustly.agents.create",
      "bustly.agents.update",
      "bustly.agents.delete",
      "bustly.sessions.create",
      "bustly.runtime.report-issue",
      "bustly.runtime.bootstrap",
      "bustly.runtime.manifest.apply",
    ]) {
      expect(isGatewayMethodClassified(method)).toBe(true);
      expect(resolveLeastPrivilegeOperatorScopesForMethod(method)).toEqual([WRITE_SCOPE]);
      expect(authorizeOperatorScopesForMethod(method, [READ_SCOPE])).toEqual({
        allowed: false,
        missingScope: WRITE_SCOPE,
      });
      expect(authorizeOperatorScopesForMethod(method, [WRITE_SCOPE])).toEqual({
        allowed: true,
      });
    }
  });
});
