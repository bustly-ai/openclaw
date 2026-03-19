import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadRemoteWorkspaceTemplate,
  resolveRemoteWorkspaceTemplateBaseUrl,
} from "./workspace-remote-templates.js";
import { loadWorkspaceTemplate, resetWorkspaceTemplateCache } from "./workspace.js";

const tempDirs: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-remote-templates-"));
  tempDirs.push(root);
  return root;
}

describe("workspace remote templates", () => {
  afterEach(async () => {
    resetWorkspaceTemplateCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("resolves remote template base url from bustly env", () => {
    expect(
      resolveRemoteWorkspaceTemplateBaseUrl({
        BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/prompts/",
      } as NodeJS.ProcessEnv),
    ).toBe("https://example.com/prompts");
  });

  it("ignores non-bustly env keys", () => {
    expect(
      resolveRemoteWorkspaceTemplateBaseUrl({
        OPENCLAW_WORKSPACE_TEMPLATE_BASE_URL: "https://fallback.example.com/prompts",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it("fetches remote templates", async () => {
    const home = await makeTempRoot();
    const fetchMock = vi.fn(async () => new Response("# Remote Agents\n", { status: 200 }));

    const content = await loadRemoteWorkspaceTemplate("AGENTS.md", {
      env: {
        OPENCLAW_HOME: home,
        BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/openclaw-prompts",
      } as NodeJS.ProcessEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(content).toBe("# Remote Agents\n");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/openclaw-prompts/AGENTS.md");
  });

  it("falls back to local templates when remote fetch fails", async () => {
    const env = {
      BUSTLY_WORKSPACE_TEMPLATE_BASE_URL: "https://example.com/openclaw-prompts",
    } as NodeJS.ProcessEnv;

    const content = await loadRemoteWorkspaceTemplate("SOUL.md", {
      env,
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });

    expect(content).toBeUndefined();
  });

  it("lets loadWorkspaceTemplate prefer remote content over local templates", async () => {
    const home = await makeTempRoot();
    vi.stubEnv("OPENCLAW_HOME", home);
    vi.stubEnv(
      "BUSTLY_WORKSPACE_TEMPLATE_BASE_URL",
      "https://example.com/openclaw-prompts",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/AGENTS.md")) {
          return new Response("---\ntitle: x\n---\n# Remote Preferred\n", { status: 200 });
        }
        return new Response("missing", { status: 404, statusText: "Not Found" });
      }),
    );

    const content = await loadWorkspaceTemplate("AGENTS.md");

    expect(content).toBe("# Remote Preferred\n");
  });
});
