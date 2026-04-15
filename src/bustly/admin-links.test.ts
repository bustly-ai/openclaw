import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBustlyAdminLink, resolveBustlyWebBaseUrl } from "./admin-links.js";

describe("bustly admin links", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a Bustly web base url", () => {
    vi.stubEnv("BUSTLY_ACCOUNT_WEB_BASE_URL", "");
    vi.stubEnv("BUSTLY_WEB_BASE_URL", "");
    expect(() => resolveBustlyWebBaseUrl()).toThrow("Missing Bustly web base URL");
  });

  it("prefers BUSTLY_ACCOUNT_WEB_BASE_URL", () => {
    vi.stubEnv("BUSTLY_ACCOUNT_WEB_BASE_URL", "https://test-bustly-account.bustly.ai/");
    vi.stubEnv("BUSTLY_WEB_BASE_URL", "https://legacy-web.example.com/");
    expect(resolveBustlyWebBaseUrl()).toBe("https://test-bustly-account.bustly.ai");
  });

  it("builds profile settings link", () => {
    vi.stubEnv("BUSTLY_ACCOUNT_WEB_BASE_URL", "https://www.bustly.ai/");
    expect(
      resolveBustlyAdminLink({
        kind: "settings",
      }),
    ).toBe("https://www.bustly.ai/admin?setting_modal=profile");
  });

  it("builds workspace links", () => {
    vi.stubEnv("BUSTLY_ACCOUNT_WEB_BASE_URL", "https://www.bustly.ai");
    expect(
      resolveBustlyAdminLink({
        kind: "workspace-settings",
        workspaceId: "workspace-1",
      }),
    ).toBe("https://www.bustly.ai/admin?setting_modal=workspace-settings&workspace_id=workspace-1");
    expect(
      resolveBustlyAdminLink({
        kind: "workspace-invite",
        workspaceId: "workspace-1",
      }),
    ).toBe("https://www.bustly.ai/admin?setting_modal=members&workspace_id=workspace-1");
    expect(
      resolveBustlyAdminLink({
        kind: "workspace-manage",
        workspaceId: "workspace-1",
      }),
    ).toBe("https://www.bustly.ai/admin?setting_modal=billing&workspace_id=workspace-1");
    expect(
      resolveBustlyAdminLink({
        kind: "workspace-pricing",
        workspaceId: "workspace-1",
      }),
    ).toBe("https://www.bustly.ai/admin?payment_modal=pricing&workspace_id=workspace-1");
  });

  it("supports workspace-create with optional workspace id", () => {
    vi.stubEnv("BUSTLY_ACCOUNT_WEB_BASE_URL", "https://www.bustly.ai");
    expect(
      resolveBustlyAdminLink({
        kind: "workspace-create",
      }),
    ).toBe("https://www.bustly.ai/admin/onboarding");
    expect(
      resolveBustlyAdminLink({
        kind: "workspace-create",
        workspaceId: "workspace-2",
      }),
    ).toBe("https://www.bustly.ai/admin/onboarding?workspace_id=workspace-2");
  });

  it("requires workspace id for workspace-scoped links", () => {
    vi.stubEnv("BUSTLY_ACCOUNT_WEB_BASE_URL", "https://www.bustly.ai");
    expect(() =>
      resolveBustlyAdminLink({
        kind: "workspace-settings",
      }),
    ).toThrow("workspaceId is required");
  });
});
