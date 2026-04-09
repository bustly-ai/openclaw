import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";
import { LARGE_TOOL_RESULT_MIN_CHARS } from "./write-large-tool-result.constants.js";

const WriteLargeToolResultSchema = Type.Object({
  path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
});

function extractToolResultText(message: AgentMessage): string {
  const role = (message as { role?: unknown }).role;
  if (role !== "toolResult" && role !== "tool") {
    return "";
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      if ((block as { type?: unknown }).type !== "text") {
        return "";
      }
      const text = (block as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function findLatestLargeToolResult(messages: AgentMessage[], minChars: number): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = extractToolResultText(messages[index]);
    if (text.length >= minChars) {
      return text;
    }
  }
  return null;
}

export function createWriteLargeToolResultTool(params: {
  cwd: string;
  getMessages: () => AgentMessage[];
  minChars?: number;
}): AnyAgentTool {
  const minChars = Math.max(1, Math.floor(params.minChars ?? LARGE_TOOL_RESULT_MIN_CHARS));
  return {
    name: "write_large_tool_result",
    label: "write_large_tool_result",
    description:
      "Write the most recent large tool result to a file. Use this instead of write(content) when saving large transcripts, fetched pages, or search results.",
    parameters: WriteLargeToolResultSchema,
    execute: async (_toolCallId, args) => {
      const input = args as Record<string, unknown>;
      const rawPath = readStringParam(input, "path", { required: true, trim: false });
      const content = findLatestLargeToolResult(params.getMessages(), minChars);
      if (!content) {
        throw new Error("No large tool result is available to write.");
      }

      const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(params.cwd, rawPath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf8");
      return {
        content: [
          {
            type: "text",
            text: `Successfully wrote ${content.length} bytes from latest large tool result to ${rawPath}`,
          },
        ],
        details: {
          path: rawPath,
          bytes: content.length,
          source: "latest_large_tool_result",
        },
      };
    },
  };
}
