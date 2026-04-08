import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import "./test-helpers/fast-coding-tools.js";
import { createOpenClawCodingTools } from "./pi-tools.js";
import { expectReadWriteEditTools } from "./test-helpers/pi-tools-fs-helpers.js";

describe("createOpenClawCodingTools", () => {
  it("accepts Claude Code parameter aliases for read/write/edit", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-alias-"));
    try {
      const tools = createOpenClawCodingTools({ workspaceDir: tmpDir });
      const { readTool, writeTool, editTool } = expectReadWriteEditTools(tools);

      const filePath = "alias-test.txt";
      await writeTool?.execute("tool-alias-1", {
        file_path: filePath,
        content: "hello world",
      });

      await editTool?.execute("tool-alias-2", {
        file_path: filePath,
        old_string: "world",
        new_string: "universe",
      });

      const result = await readTool?.execute("tool-alias-3", {
        file_path: filePath,
      });

      const textBlocks = result?.content?.filter((block) => block.type === "text") as
        | Array<{ text?: string }>
        | undefined;
      const combinedText = textBlocks?.map((block) => block.text ?? "").join("\n");
      expect(combinedText).toContain("hello universe");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("coerces structured content blocks for write", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-structured-write-"));
    try {
      const tools = createOpenClawCodingTools({ workspaceDir: tmpDir });
      const writeTool = tools.find((tool) => tool.name === "write");
      expect(writeTool).toBeDefined();

      await writeTool?.execute("tool-structured-write", {
        path: "structured-write.js",
        content: [
          { type: "text", text: "const path = require('path');\n" },
          { type: "input_text", text: "const root = path.join(process.env.HOME, 'clawd');\n" },
        ],
      });

      const written = await fs.readFile(path.join(tmpDir, "structured-write.js"), "utf8");
      expect(written).toBe(
        "const path = require('path');\nconst root = path.join(process.env.HOME, 'clawd');\n",
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("coerces structured old/new text blocks for edit", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-structured-edit-"));
    try {
      const filePath = path.join(tmpDir, "structured-edit.js");
      await fs.writeFile(filePath, "const value = 'old';\n", "utf8");

      const tools = createOpenClawCodingTools({ workspaceDir: tmpDir });
      const editTool = tools.find((tool) => tool.name === "edit");
      expect(editTool).toBeDefined();

      await editTool?.execute("tool-structured-edit", {
        file_path: "structured-edit.js",
        old_string: [{ type: "text", text: "old" }],
        new_string: [{ kind: "text", value: "new" }],
      });

      const edited = await fs.readFile(filePath, "utf8");
      expect(edited).toBe("const value = 'new';\n");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("guides large file writes toward the dedicated large tool result writer", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-write-description-"));
    try {
      const tools = createOpenClawCodingTools({ workspaceDir: tmpDir });
      const writeTool = tools.find((tool) => tool.name === "write");
      expect(writeTool?.description).toContain("write_large_tool_result");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("includes extra tools in the wrapped tool list", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-extra-tools-"));
    try {
      const tools = createOpenClawCodingTools({
        workspaceDir: tmpDir,
        extraTools: [
          {
            name: "write_large_tool_result",
            label: "write_large_tool_result",
            description: "Write the latest large tool result to a file",
            parameters: Type.Object({
              path: Type.String(),
            }),
            execute: async () => ({
              content: [{ type: "text", text: "ok" }],
            }),
          },
        ],
      });
      const extraTool = tools.find((tool) => tool.name === "write_large_tool_result");
      expect(extraTool).toBeDefined();
      expect(extraTool?.description).toContain("latest large tool result");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
