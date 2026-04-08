import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { createWriteLargeToolResultTool } from "./write-large-tool-result-tool.js";
import { LARGE_TOOL_RESULT_MIN_CHARS } from "./write-large-tool-result.constants.js";

function createToolResult(text: string): AgentMessage {
  return {
    role: "toolResult",
    content: [{ type: "text", text }],
  } as AgentMessage;
}

describe("createWriteLargeToolResultTool", () => {
  it("writes the most recent large tool result instead of a later small one", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-large-tool-result-"));
    try {
      const outputPath = path.join(tmpDir, "transcript.md");
      const largeText = "A".repeat(LARGE_TOOL_RESULT_MIN_CHARS + 128);
      const tool = createWriteLargeToolResultTool({
        cwd: tmpDir,
        getMessages: () => [createToolResult(largeText), createToolResult("small skill output")],
      });

      const result = await tool.execute("tool-write-large", {
        path: outputPath,
      });

      expect(await fs.readFile(outputPath, "utf8")).toBe(largeText);
      const text = result.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      expect(text).toContain("Successfully wrote");
      expect(text).toContain("transcript.md");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("fails when there is no large tool result available", async () => {
    const tool = createWriteLargeToolResultTool({
      cwd: os.tmpdir(),
      getMessages: () => [createToolResult("small output")],
    });

    await expect(
      tool.execute("tool-write-missing", {
        path: "missing.md",
      }),
    ).rejects.toThrow("No large tool result");
  });
});
