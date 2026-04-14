import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeSkill } from "../agents/skills.e2e-test-helpers.js";
import { withEnvAsync } from "../test-utils/env.js";
import { connectOk, installGatewayTestHooks, rpcReq } from "./test-helpers.js";
import { withServer } from "./test-with-server.js";

installGatewayTestHooks({ scope: "suite" });

describe("gateway skills.status", () => {
  it("does not expose raw config values to operator.read clients", async () => {
    const bundledDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-bundled-skills-"));
    await writeSkill({
      dir: path.join(bundledDir, "discord"),
      name: "discord",
      description: "Discord integration",
      body: "# Discord\n",
      metadata: JSON.stringify({
        openclaw: {
          requires: {
            config: ["channels.discord.token"],
          },
        },
      }),
    });
    await withEnvAsync(
      { OPENCLAW_BUNDLED_SKILLS_DIR: bundledDir },
      async () => {
        const secret = "discord-token-secret-abc";
        const { writeConfigFile } = await import("../config/config.js");
        await writeConfigFile({
          session: { mainKey: "main-test" },
          channels: {
            discord: {
              token: secret,
            },
          },
        });

        await withServer(async (ws) => {
          await connectOk(ws, { token: "secret", scopes: ["operator.read"] });
          const res = await rpcReq<{
            skills?: Array<{
              name?: string;
              configChecks?: Array<
                { path?: string; satisfied?: boolean } & Record<string, unknown>
              >;
            }>;
          }>(ws, "skills.status", { agentId: "main" });

          expect(res.ok).toBe(true);
          expect(JSON.stringify(res.payload)).not.toContain(secret);

          const discord = res.payload?.skills?.find((s) => s.name === "discord");
          expect(discord).toBeTruthy();
          const check = discord?.configChecks?.find((c) => c.path === "channels.discord.token");
          expect(check).toBeTruthy();
          expect(check?.satisfied).toBe(true);
          expect(check && "value" in check).toBe(false);
        });
      },
    );
  });

  it("accepts dynamic bustly workspace agent ids", async () => {
    await withServer(async (ws) => {
      await connectOk(ws, { token: "secret", scopes: ["operator.read"] });
      const res = await rpcReq<{ workspaceDir?: string }>(ws, "skills.status", {
        agentId: "bustly-9a85bcbe-a783-4b37-81d1-229d176e9d87",
      });

      expect(res.ok).toBe(true);
      expect(typeof res.payload?.workspaceDir).toBe("string");
    });
  });
});
