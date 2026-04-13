import { afterEach, describe, expect, it, vi } from "vitest";
import * as configModule from "../../config/config.js";
import { ErrorCodes } from "../protocol/index.js";
import { bustlyLinksHandlers } from "./bustly-links.js";

async function invoke(params: Record<string, unknown>) {
  const respond = vi.fn();
  await bustlyLinksHandlers["bustly.links.resolve"]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("gateway bustly.links.resolve", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("validates kind", async () => {
    const respond = await invoke({});
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: expect.stringContaining("kind is required"),
      }),
    );
  });

  it("returns workspace settings link", async () => {
    vi.stubEnv("BUSTLY_WEB_BASE_URL", "https://www.bustly.ai");
    const respond = await invoke({
      kind: "workspace-settings",
      workspaceId: "workspace-1",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        kind: "workspace-settings",
        url: "https://www.bustly.ai/admin?setting_modal=workspace-settings&workspace_id=workspace-1",
      },
      undefined,
    );
  });

  it("returns INVALID_REQUEST when workspace-scoped kind omits workspaceId", async () => {
    vi.stubEnv("BUSTLY_WEB_BASE_URL", "https://www.bustly.ai");
    const respond = await invoke({
      kind: "workspace-pricing",
    });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "workspaceId is required",
      }),
    );
  });

  it("falls back to BUSTLY_API_BASE_URL when web base env is missing", async () => {
    vi.stubEnv("BUSTLY_WEB_BASE_URL", "");
    vi.stubEnv("BUSTLY_API_BASE_URL", "https://test-gw.bustly.ai/api/v1");
    const respond = await invoke({
      kind: "settings",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        kind: "settings",
        url: "https://test-gw.bustly.ai/admin?setting_modal=profile",
      },
      undefined,
    );
  });

  it("falls back to bustly provider baseUrl from config when env is missing", async () => {
    vi.stubEnv("BUSTLY_WEB_BASE_URL", "");
    vi.stubEnv("BUSTLY_API_BASE_URL", "");
    vi.spyOn(configModule, "loadConfig").mockReturnValue({
      models: {
        providers: {
          bustly: {
            baseUrl: "https://model-gw.bustly.ai/api/v1",
          },
        },
      },
    } as never);
    const respond = await invoke({
      kind: "settings",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        kind: "settings",
        url: "https://model-gw.bustly.ai/admin?setting_modal=profile",
      },
      undefined,
    );
  });
});
