import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

const mocks = vi.hoisted(() => ({
  listBustlyGlobalSkillCatalog: vi.fn(),
  installBustlyGlobalSkill: vi.fn(),
}));

vi.mock("../../bustly/skill-catalog.js", () => ({
  listBustlyGlobalSkillCatalog: () => mocks.listBustlyGlobalSkillCatalog(),
  installBustlyGlobalSkill: (skillKey: string) => mocks.installBustlyGlobalSkill(skillKey),
}));

const { skillsHandlers } = await import("./skills.js");

describe("skills.catalog gateway handlers", () => {
  beforeEach(() => {
    mocks.listBustlyGlobalSkillCatalog.mockReset();
    mocks.installBustlyGlobalSkill.mockReset();
  });

  it("lists global skill catalog items", async () => {
    mocks.listBustlyGlobalSkillCatalog.mockResolvedValue([
      {
        id: "meta-ads",
        name: "meta-ads",
        description: "Run Meta Ads workflows.",
        source: "skillops-catalog",
        sourceLabel: "Catalog",
        skillKey: "meta-ads",
        filePath: "",
        eligible: false,
        bundled: false,
        category: "Ads",
        installed: false,
        canInstall: true,
      },
    ]);

    const respond = vi.fn();
    await skillsHandlers["skills.catalog.list"]({
      params: {},
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      [
        expect.objectContaining({
          skillKey: "meta-ads",
          canInstall: true,
        }),
      ],
      undefined,
    );
  });

  it("installs a global skill catalog item", async () => {
    const respond = vi.fn();
    await skillsHandlers["skills.catalog.install"]({
      params: { skillKey: "meta-ads" },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(mocks.installBustlyGlobalSkill).toHaveBeenCalledWith("meta-ads");
    expect(respond).toHaveBeenCalledWith(
      true,
      { ok: true, skillKey: "meta-ads" },
      undefined,
    );
  });

  it("validates required skillKey for install", async () => {
    const respond = vi.fn();
    await skillsHandlers["skills.catalog.install"]({
      params: {},
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(mocks.installBustlyGlobalSkill).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "skillKey is required",
      }),
    );
  });
});
