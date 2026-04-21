import { describe, expect, it } from "vitest";
import type { HandleCommandsParams } from "./commands-types.js";
import { resolveCommandsSystemPromptBundle } from "./commands-system-prompt.js";
import { DEFAULT_AGENTS_FILENAME } from "../../agents/workspace.js";
import { makeTempWorkspace, writeWorkspaceFile } from "../../test-helpers/workspace.js";

describe("resolveCommandsSystemPromptBundle", () => {
  it("injects bootstrap context files into the system prompt", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-commands-system-prompt-");
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: DEFAULT_AGENTS_FILENAME,
      content: "Bootstrap instructions",
    });

    const bundle = await resolveCommandsSystemPromptBundle({
      command: {
        channel: "telegram",
        senderIsOwner: true,
      },
      sessionKey: "agent:default:main",
      workspaceDir,
      provider: "openai",
      model: "gpt-5",
      elevated: { allowed: false },
      resolvedThinkLevel: "off",
      resolvedReasoningLevel: "off",
      resolvedElevatedLevel: "off",
      cfg: {},
      ctx: {},
    } as unknown as HandleCommandsParams);

    expect(bundle.bootstrapFiles.some((file) => file.name === DEFAULT_AGENTS_FILENAME)).toBe(true);
    expect(bundle.injectedFiles.length).toBeGreaterThan(0);
    expect(bundle.systemPrompt).toContain("## Workspace Files (injected)");
    expect(bundle.systemPrompt).toContain("# Project Context");
    expect(bundle.systemPrompt).toContain("Bootstrap instructions");
  });
});
