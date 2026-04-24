import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  configDirRef,
  supabaseRowsRef,
  fetchPayloadRef,
  fetchStatusRef,
  artifactFetchMock,
  extractArchiveMock,
  bumpSkillsSnapshotVersionMock,
} = vi.hoisted(() => ({
  configDirRef: { current: "" },
  supabaseRowsRef: { current: [] as unknown[] },
  fetchPayloadRef: { current: Buffer.from("skill-archive") },
  fetchStatusRef: { current: 200 },
  artifactFetchMock: vi.fn(),
  extractArchiveMock: vi.fn(),
  bumpSkillsSnapshotVersionMock: vi.fn(),
}));

vi.mock("../utils.js", () => ({
  get CONFIG_DIR() {
    return configDirRef.current;
  },
}));

vi.mock("./supabase.js", () => ({
  bustlySupabaseFetch: vi.fn(async () => {
    return new Response(JSON.stringify(supabaseRowsRef.current), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }),
}));

vi.mock("../infra/archive.js", () => ({
  extractArchive: (...args: unknown[]) => extractArchiveMock(...args),
}));

vi.mock("../agents/skills/refresh.js", () => ({
  bumpSkillsSnapshotVersion: (...args: unknown[]) => bumpSkillsSnapshotVersionMock(...args),
}));

function sha256Hex(payload: Buffer): string {
  const hash = createHash("sha256");
  hash.update(payload);
  return hash.digest("hex");
}

function createCatalogRow(params: {
  slug: string;
  name?: string;
  publishedVersionId?: string;
  zipUrl?: string;
  sha256?: string;
  layer?: string;
  subLayer?: string;
}): Record<string, unknown> {
  return {
    slug: params.slug,
    name: params.name ?? params.slug,
    description: `${params.slug} skill`,
    layer: params.layer ?? "core",
    sub_layer: params.subLayer ?? "ads",
    status: "enabled",
    published_version_id: params.publishedVersionId ?? "v1",
    published_zip_url: params.zipUrl,
    published_zip_sha256: params.sha256,
  };
}

describe("bustly skill catalog", () => {
  let tempRoot: string;
  let bundledSkillsDir: string;
  let previousBundledSkillsEnv: string | undefined;
  let previousDefaultEnabledSkillsJsonEnv: string | undefined;
  let previousDefaultEnabledSkillsEnv: string | undefined;

  function writeDefaultEnabledSkills(defaultEnabled: string[]): void {
    writeFileSync(
      path.join(bundledSkillsDir, ".bustly-default-enabled.json"),
      JSON.stringify({ version: 1, defaultEnabled }, null, 2),
    );
  }

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), "openclaw-skill-catalog-"));
    configDirRef.current = path.join(tempRoot, "state");
    mkdirSync(configDirRef.current, { recursive: true });
    bundledSkillsDir = path.join(tempRoot, "bustly-skills", "skills");
    mkdirSync(bundledSkillsDir, { recursive: true });
    writeDefaultEnabledSkills([]);
    previousBundledSkillsEnv = process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
    previousDefaultEnabledSkillsJsonEnv = process.env.BUSTLY_DEFAULT_ENABLED_SKILLS_JSON;
    previousDefaultEnabledSkillsEnv = process.env.BUSTLY_DEFAULT_ENABLED_SKILLS;
    process.env.OPENCLAW_BUNDLED_SKILLS_DIR = bundledSkillsDir;
    delete process.env.BUSTLY_DEFAULT_ENABLED_SKILLS_JSON;
    delete process.env.BUSTLY_DEFAULT_ENABLED_SKILLS;

    supabaseRowsRef.current = [];
    fetchPayloadRef.current = Buffer.from("skill-archive");
    fetchStatusRef.current = 200;

    artifactFetchMock.mockReset();
    artifactFetchMock.mockImplementation(async () =>
      new Response(fetchPayloadRef.current, {
        status: fetchStatusRef.current,
      }),
    );
    vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => artifactFetchMock(...args));

    extractArchiveMock.mockReset();
    extractArchiveMock.mockImplementation(async (params: { destDir: string }) => {
      writeFileSync(path.join(params.destDir, "SKILL.md"), "# test skill\n");
    });

    bumpSkillsSnapshotVersionMock.mockReset();
  });

  afterEach(() => {
    if (previousBundledSkillsEnv === undefined) {
      delete process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
    } else {
      process.env.OPENCLAW_BUNDLED_SKILLS_DIR = previousBundledSkillsEnv;
    }
    if (previousDefaultEnabledSkillsJsonEnv === undefined) {
      delete process.env.BUSTLY_DEFAULT_ENABLED_SKILLS_JSON;
    } else {
      process.env.BUSTLY_DEFAULT_ENABLED_SKILLS_JSON = previousDefaultEnabledSkillsJsonEnv;
    }
    if (previousDefaultEnabledSkillsEnv === undefined) {
      delete process.env.BUSTLY_DEFAULT_ENABLED_SKILLS;
    } else {
      process.env.BUSTLY_DEFAULT_ENABLED_SKILLS = previousDefaultEnabledSkillsEnv;
    }
    rmSync(tempRoot, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("computes installed/update/install states from default + managed manifests", async () => {
    writeDefaultEnabledSkills(["default-ops"]);
    const managedSkillDir = path.join(configDirRef.current, "skills", "meta-ads");
    mkdirSync(managedSkillDir, { recursive: true });
    writeFileSync(path.join(managedSkillDir, "SKILL.md"), "# meta ads\n");
    writeFileSync(
      path.join(managedSkillDir, ".bustly-skill.json"),
      JSON.stringify(
        {
          skillKey: "meta-ads",
          publishedVersionId: "v1",
          installedAt: "2026-01-01T00:00:00.000Z",
          source: "skillops-zip",
        },
        null,
        2,
      ),
    );

    const payload = Buffer.from("skill-archive");
    const artifactSha = sha256Hex(payload);
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "default-ops",
        publishedVersionId: "v3",
        zipUrl: "https://example.com/default-ops.zip",
        sha256: artifactSha,
      }),
      createCatalogRow({
        slug: "meta-ads",
        layer: "ecommerce",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/meta-ads.zip",
        sha256: artifactSha,
      }),
      createCatalogRow({
        slug: "brand-new",
        publishedVersionId: "v1",
        zipUrl: "https://example.com/brand-new.zip",
        sha256: artifactSha,
      }),
      createCatalogRow({
        slug: "layer-missing",
        layer: "",
        subLayer: "ads",
        publishedVersionId: "v1",
        zipUrl: "https://example.com/layer-missing.zip",
        sha256: artifactSha,
      }),
      createCatalogRow({
        slug: "missing-zip",
        publishedVersionId: "v2",
      }),
      createCatalogRow({
        slug: "missing-published-version",
        publishedVersionId: "",
        zipUrl: "https://example.com/missing-version.zip",
        sha256: artifactSha,
      }),
    ];

    const mod = await import("./skill-catalog.js");
    const items = await mod.listBustlyGlobalSkillCatalog();
    const byKey = new Map(items.map((item) => [item.skillKey, item]));

    expect(byKey.get("default-ops")).toMatchObject({
      defaultInstalled: true,
      installed: true,
      installedVersionId: "v3",
      publishedVersionId: "v3",
      hasUpdate: false,
      canInstall: false,
      canUpdate: false,
      canUninstall: false,
    });
    expect(byKey.get("meta-ads")).toMatchObject({
      installed: true,
      installedVersionId: "v1",
      publishedVersionId: "v2",
      category: "Ecommerce / DTC",
      hasUpdate: true,
      canInstall: false,
      canUpdate: true,
      canUninstall: true,
    });
    expect(byKey.get("brand-new")).toMatchObject({
      installed: false,
      installedVersionId: undefined,
      publishedVersionId: "v1",
      hasUpdate: false,
      canInstall: true,
      canUpdate: false,
      canUninstall: false,
    });
    expect(byKey.get("layer-missing")).toMatchObject({
      category: "Uncategorized",
    });
    expect(byKey.has("missing-zip")).toBe(false);
    expect(byKey.has("missing-published-version")).toBe(false);

    const snapshotPath = path.join(configDirRef.current, "skills", ".bustly-default-installed.json");
    expect(existsSync(snapshotPath)).toBe(true);
    await Promise.resolve();
    expect(artifactFetchMock).toHaveBeenCalledTimes(1);
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8")) as {
      skills: Array<{ skillKey: string; installedVersionId?: string }>;
    };
    expect(snapshot.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillKey: "default-ops",
          installedVersionId: "v3",
        }),
      ]),
    );
  });

  it("does not block catalog listing on default skill materialization", async () => {
    writeDefaultEnabledSkills(["default-ops"]);
    const checksum = sha256Hex(Buffer.from("deferred-default-zip"));
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "default-ops",
        publishedVersionId: "v4",
        zipUrl: "https://example.com/default-ops.zip",
        sha256: checksum,
      }),
    ];

    let releaseDownload: (() => void) | null = null;
    artifactFetchMock.mockImplementationOnce(
      async () =>
        await new Promise((resolve) => {
          releaseDownload = () => {
            resolve(new Response(Buffer.from("deferred-default-zip"), { status: 200 }));
          };
        }),
    );

    const mod = await import("./skill-catalog.js");
    const items = await mod.listBustlyGlobalSkillCatalog();
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillKey: "default-ops",
          defaultInstalled: true,
          installed: true,
          installedVersionId: "v4",
        }),
      ]),
    );
    expect(artifactFetchMock).toHaveBeenCalledTimes(1);

    releaseDownload?.();
    await Promise.resolve();
  });

  it("installs default-installed skills when install is requested without managed files", async () => {
    writeDefaultEnabledSkills(["default-ops"]);
    fetchPayloadRef.current = Buffer.from("default-zip");
    const checksum = sha256Hex(fetchPayloadRef.current);
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "default-ops",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/default-ops.zip",
        sha256: checksum,
      }),
    ];

    const mod = await import("./skill-catalog.js");
    await mod.installBustlyGlobalSkill("default-ops");

    const installDir = path.join(configDirRef.current, "skills", "default-ops");
    expect(existsSync(path.join(installDir, "SKILL.md"))).toBe(true);
    expect(
      JSON.parse(readFileSync(path.join(installDir, ".bustly-skill.json"), "utf-8")),
    ).toMatchObject({
      skillKey: "default-ops",
      publishedVersionId: "v2",
      source: "skillops-zip",
    });
  });

  it("falls back to env-provided default-installed skills when bundled default file is unavailable", async () => {
    delete process.env.OPENCLAW_BUNDLED_SKILLS_DIR;
    process.env.BUSTLY_DEFAULT_ENABLED_SKILLS_JSON = JSON.stringify([
      "commerce-core-ops",
      "ads-core-ops",
    ]);

    fetchPayloadRef.current = Buffer.from("zip-success");
    const checksum = sha256Hex(fetchPayloadRef.current);
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "commerce-core-ops",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/commerce-core-ops.zip",
        sha256: checksum,
      }),
      createCatalogRow({
        slug: "ads-core-ops",
        publishedVersionId: "v1",
        zipUrl: "https://example.com/ads-core-ops.zip",
        sha256: checksum,
      }),
    ];

    const mod = await import("./skill-catalog.js");
    const items = await mod.listBustlyGlobalSkillCatalog();
    const byKey = new Map(items.map((item) => [item.skillKey, item]));

    expect(byKey.get("commerce-core-ops")).toMatchObject({
      defaultInstalled: true,
      installed: true,
    });
    expect(byKey.get("ads-core-ops")).toMatchObject({
      defaultInstalled: true,
      installed: true,
    });
  });

  it("does not auto-update already installed default skills during catalog listing", async () => {
    writeDefaultEnabledSkills(["default-ops"]);
    const installDir = path.join(configDirRef.current, "skills", "default-ops");
    mkdirSync(installDir, { recursive: true });
    writeFileSync(path.join(installDir, "SKILL.md"), "# default ops\n");
    writeFileSync(
      path.join(installDir, ".bustly-skill.json"),
      JSON.stringify(
        {
          skillKey: "default-ops",
          publishedVersionId: "v1",
          installedAt: "2026-01-01T00:00:00.000Z",
          source: "skillops-zip",
        },
        null,
        2,
      ),
    );

    fetchPayloadRef.current = Buffer.from("default-zip");
    const checksum = sha256Hex(fetchPayloadRef.current);
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "default-ops",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/default-ops.zip",
        sha256: checksum,
      }),
    ];

    const mod = await import("./skill-catalog.js");
    const items = await mod.listBustlyGlobalSkillCatalog();
    const item = items.find((entry) => entry.skillKey === "default-ops");
    expect(item).toMatchObject({
      defaultInstalled: true,
      installed: true,
      installedVersionId: "v1",
      publishedVersionId: "v2",
      hasUpdate: true,
      canInstall: false,
      canUpdate: true,
      canUninstall: false,
    });

    expect(
      JSON.parse(readFileSync(path.join(installDir, ".bustly-skill.json"), "utf-8")),
    ).toMatchObject({
      publishedVersionId: "v1",
    });
    expect(artifactFetchMock).not.toHaveBeenCalled();
  });

  it("installs from skillops zip artifact and writes manifest", async () => {
    fetchPayloadRef.current = Buffer.from("zip-success");
    const checksum = sha256Hex(fetchPayloadRef.current);
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "meta-ads",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/meta-ads.zip",
        sha256: checksum,
      }),
    ];

    const mod = await import("./skill-catalog.js");
    await mod.installBustlyGlobalSkill("meta-ads");
    await mod.installBustlyGlobalSkill("meta-ads");

    const installDir = path.join(configDirRef.current, "skills", "meta-ads");
    expect(existsSync(path.join(installDir, "SKILL.md"))).toBe(true);
    expect(
      JSON.parse(readFileSync(path.join(installDir, ".bustly-skill.json"), "utf-8")),
    ).toMatchObject({
      skillKey: "meta-ads",
      publishedVersionId: "v2",
      source: "skillops-zip",
    });

    expect(bumpSkillsSnapshotVersionMock).toHaveBeenCalledTimes(1);
  });

  it("installs uploaded skill archives into managed skills with local-upload manifest", async () => {
    const sourceArchive = path.join(tempRoot, "uploaded.skill.zip");
    writeFileSync(sourceArchive, "not-a-real-zip");

    const mod = await import("./skill-catalog.js");
    const result = await mod.installBustlyUploadedSkillFromPath(sourceArchive);

    expect(result.skillKey).toBe("test-skill");
    const installDir = path.join(configDirRef.current, "skills", "test-skill");
    expect(result.installDir).toBe(installDir);
    expect(result.sourcePath).toBe(sourceArchive);
    expect(result.sourceKind).toBe("file");
    expect(existsSync(path.join(installDir, "SKILL.md"))).toBe(true);
    expect(
      JSON.parse(readFileSync(path.join(installDir, ".bustly-skill.json"), "utf-8")),
    ).toMatchObject({
      skillKey: "test-skill",
      source: "local-upload",
      name: "test skill",
    });
    expect(bumpSkillsSnapshotVersionMock).toHaveBeenCalledTimes(1);
  });

  it("lists uploaded local skills as managed entries when absent from catalog", async () => {
    const managedDir = path.join(configDirRef.current, "skills", "uploaded-custom");
    mkdirSync(managedDir, { recursive: true });
    writeFileSync(path.join(managedDir, "SKILL.md"), "---\nname: Uploaded Custom\ndescription: Uploaded skill\n---\n");
    writeFileSync(
      path.join(managedDir, ".bustly-skill.json"),
      JSON.stringify(
        {
          skillKey: "uploaded-custom",
          installedAt: "2026-04-20T00:00:00.000Z",
          source: "local-upload",
        },
        null,
        2,
      ),
    );
    supabaseRowsRef.current = [];

    const mod = await import("./skill-catalog.js");
    const items = await mod.listBustlyGlobalSkillCatalog();
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillKey: "uploaded-custom",
          source: "openclaw-managed",
          installed: true,
          canInstall: false,
          canUpdate: false,
          canUninstall: true,
        }),
      ]),
    );
  });

  it("fails update when zip checksum mismatches", async () => {
    const installDir = path.join(configDirRef.current, "skills", "meta-ads");
    mkdirSync(installDir, { recursive: true });
    writeFileSync(path.join(installDir, "SKILL.md"), "# old skill\n");
    writeFileSync(
      path.join(installDir, ".bustly-skill.json"),
      JSON.stringify(
        {
          skillKey: "meta-ads",
          publishedVersionId: "v1",
          installedAt: "2026-01-01T00:00:00.000Z",
          source: "skillops-zip",
        },
        null,
        2,
      ),
    );

    fetchPayloadRef.current = Buffer.from("zip-new");
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "meta-ads",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/meta-ads.zip",
        sha256: "deadbeef",
      }),
    ];

    const mod = await import("./skill-catalog.js");
    await expect(mod.updateBustlyGlobalSkill("meta-ads")).rejects.toThrow(
      "Skill package checksum mismatch",
    );
    expect(bumpSkillsSnapshotVersionMock).not.toHaveBeenCalled();
  });

  it("uninstalls managed skills and is idempotent", async () => {
    const installDir = path.join(configDirRef.current, "skills", "meta-ads");
    mkdirSync(installDir, { recursive: true });
    writeFileSync(path.join(installDir, "SKILL.md"), "# old skill\n");
    writeFileSync(
      path.join(installDir, ".bustly-skill.json"),
      JSON.stringify(
        {
          skillKey: "meta-ads",
          publishedVersionId: "v1",
          installedAt: "2026-01-01T00:00:00.000Z",
          source: "skillops-zip",
        },
        null,
        2,
      ),
    );

    const mod = await import("./skill-catalog.js");
    await mod.uninstallBustlyGlobalSkill("meta-ads");
    await mod.uninstallBustlyGlobalSkill("meta-ads");

    expect(existsSync(installDir)).toBe(false);
    expect(bumpSkillsSnapshotVersionMock).toHaveBeenCalledTimes(1);
  });

  it("uninstalls uploaded local skills", async () => {
    const installDir = path.join(configDirRef.current, "skills", "uploaded-custom");
    mkdirSync(installDir, { recursive: true });
    writeFileSync(path.join(installDir, "SKILL.md"), "# custom\n");
    writeFileSync(
      path.join(installDir, ".bustly-skill.json"),
      JSON.stringify(
        {
          skillKey: "uploaded-custom",
          installedAt: "2026-01-01T00:00:00.000Z",
          source: "local-upload",
        },
        null,
        2,
      ),
    );

    const mod = await import("./skill-catalog.js");
    await mod.uninstallBustlyGlobalSkill("uploaded-custom");

    expect(existsSync(installDir)).toBe(false);
    expect(bumpSkillsSnapshotVersionMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces archive extraction failure without fallback", async () => {
    fetchPayloadRef.current = Buffer.from("zip-success");
    const checksum = sha256Hex(fetchPayloadRef.current);
    supabaseRowsRef.current = [
      createCatalogRow({
        slug: "meta-ads",
        publishedVersionId: "v2",
        zipUrl: "https://example.com/meta-ads.zip",
        sha256: checksum,
      }),
    ];
    extractArchiveMock.mockRejectedValueOnce(
      new Error("archive entry traverses symlink in destination"),
    );

    const mod = await import("./skill-catalog.js");
    await expect(mod.installBustlyGlobalSkill("meta-ads")).rejects.toThrow(
      "archive entry traverses symlink",
    );
    expect(existsSync(path.join(configDirRef.current, "skills", "meta-ads"))).toBe(false);
    expect(bumpSkillsSnapshotVersionMock).not.toHaveBeenCalled();
  });
});
