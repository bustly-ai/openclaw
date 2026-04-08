import { LARGE_TOOL_RESULT_MIN_CHARS } from "./write-large-tool-result.constants.js";

const DEFAULT_PADDING_BLOCKS = 48;

function buildTranscriptSection(index: number): string {
  return [
    `## Segment ${index}`,
    `Speaker A: This is verification transcript segment ${index}.`,
    "Speaker B: We are intentionally generating a large tool result so the agent can read it first and then persist it with write_large_tool_result.",
    "Speaker A: The validation goal is to save the exact prior tool output without re-generating the transcript body or inlining it into write.content.",
    "Speaker B: If this section appears in the copied file, the dedicated large tool result writer path is working correctly.",
    "",
  ].join("\n");
}

function buildLargeTranscriptText(): string {
  const blocks = ["# Transcript Verification Fixture", ""];
  for (let index = 1; index <= DEFAULT_PADDING_BLOCKS; index += 1) {
    blocks.push(buildTranscriptSection(index));
  }
  const text = blocks.join("\n");
  if (text.length <= LARGE_TOOL_RESULT_MIN_CHARS) {
    throw new Error(
      `Verification transcript is too small: ${text.length} <= ${LARGE_TOOL_RESULT_MIN_CHARS}`,
    );
  }
  return text;
}

export function buildWriteLargeToolResultVerificationFixture(params: {
  sourcePath: string;
  destinationPath: string;
}) {
  const sourceText = buildLargeTranscriptText();
  const prompt = [
    `请先读取 ${params.sourcePath} 的完整内容，然后把“刚才读取到的内容”原样保存到 ${params.destinationPath}。`,
    "",
    "要求：",
    "1. 不要总结，不要改写",
    "2. 不要自己重新生成全文",
    "3. 不要把全文放进 write.content",
    "4. 如果前一步工具结果里已经有完整内容，请直接使用 write_large_tool_result，并且只传目标 path",
    "5. 最后告诉我你实际调用了哪些工具",
  ].join("\n");

  return {
    sourceText,
    prompt,
  };
}
