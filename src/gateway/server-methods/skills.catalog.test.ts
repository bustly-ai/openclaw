import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

const mocks = vi.hoisted(() => ({
  listBustlyGlobalSkillCatalog: vi.fn(),
  installBustlyGlobalSkill: vi.fn(),
  installBustlyUploadedSkillFromPath: vi.fn(),
  updateBustlyGlobalSkill: vi.fn(),
  uninstallBustlyGlobalSkill: vi.fn(),
}));

vi.mock("../../bustly/skill-catalog.js", () => ({
  listBustlyGlobalSkillCatalog: () => mocks.listBustlyGlobalSkillCatalog(),
  installBustlyGlobalSkill: (skillKey: string) => mocks.installBustlyGlobalSkill(skillKey),
  installBustlyUploadedSkillFromPath: (sourcePath: string) =>
    mocks.installBustlyUploadedSkillFromPath(sourcePath),
  updateBustlyGlobalSkill: (skillKey: string) => mocks.updateBustlyGlobalSkill(skillKey),
  uninstallBustlyGlobalSkill: (skillKey: string) => mocks.uninstallBustlyGlobalSkill(skillKey),
}));

const { skillsHandlers } = await import("./skills.js");

describe("skills.catalog gateway handlers", () => {
  beforeEach(() => {
    mocks.listBustlyGlobalSkillCatalog.mockReset();
    mocks.installBustlyGlobalSkill.mockReset();
    mocks.installBustlyUploadedSkillFromPath.mockReset();
    mocks.updateBustlyGlobalSkill.mockReset();
    mocks.uninstallBustlyGlobalSkill.mockReset();
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
        defaultInstalled: false,
        installed: false,
        installedVersionId: undefined,
        publishedVersionId: "v1",
        hasUpdate: false,
        canInstall: true,
        canUpdate: false,
        canUninstall: false,
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

  it("installs an uploaded local skill package", async () => {
    mocks.installBustlyUploadedSkillFromPath.mockResolvedValue({
      skillKey: "uploaded-skill",
      installDir: "/tmp/.bustly/skills/uploaded-skill",
      sourcePath: "/tmp/uploaded-skill.zip",
      sourceKind: "file",
    });
    const respond = vi.fn();
    await skillsHandlers["skills.catalog.upload"]({
      params: { path: "/tmp/uploaded-skill.zip" },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(mocks.installBustlyUploadedSkillFromPath).toHaveBeenCalledWith("/tmp/uploaded-skill.zip");
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        ok: true,
        path: "/tmp/uploaded-skill.zip",
        skillKey: "uploaded-skill",
        installDir: "/tmp/.bustly/skills/uploaded-skill",
        sourceKind: "file",
      },
      undefined,
    );
  });

  it("validates required path for upload install", async () => {
    const respond = vi.fn();
    await skillsHandlers["skills.catalog.upload"]({
      params: {},
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(mocks.installBustlyUploadedSkillFromPath).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "path is required",
      }),
    );
  });

  it("updates a global skill catalog item", async () => {
    const respond = vi.fn();
    await skillsHandlers["skills.catalog.update"]({
      params: { skillKey: "meta-ads" },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(mocks.updateBustlyGlobalSkill).toHaveBeenCalledWith("meta-ads");
    expect(respond).toHaveBeenCalledWith(
      true,
      { ok: true, skillKey: "meta-ads" },
      undefined,
    );
  });

  it("uninstalls a global skill catalog item", async () => {
    const respond = vi.fn();
    await skillsHandlers["skills.catalog.uninstall"]({
      params: { skillKey: "meta-ads" },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond,
    });

    expect(mocks.uninstallBustlyGlobalSkill).toHaveBeenCalledWith("meta-ads");
    expect(respond).toHaveBeenCalledWith(
      true,
      { ok: true, skillKey: "meta-ads" },
      undefined,
    );
  });

  it("validates required skillKey for update/uninstall", async () => {
    const respondUpdate = vi.fn();
    const respondUninstall = vi.fn();

    await skillsHandlers["skills.catalog.update"]({
      params: {},
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond: respondUpdate,
    });
    await skillsHandlers["skills.catalog.uninstall"]({
      params: {},
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond: respondUninstall,
    });

    expect(respondUpdate).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "skillKey is required",
      }),
    );
    expect(respondUninstall).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "skillKey is required",
      }),
    );
  });
});
