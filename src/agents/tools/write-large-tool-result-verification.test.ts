import { describe, expect, it } from "vitest";
import { buildWriteLargeToolResultVerificationFixture } from "./write-large-tool-result-verification.js";
import { LARGE_TOOL_RESULT_MIN_CHARS } from "./write-large-tool-result.constants.js";

describe("buildWriteLargeToolResultVerificationFixture", () => {
  it("creates source text above the large tool result threshold", () => {
    const fixture = buildWriteLargeToolResultVerificationFixture({
      sourcePath: "/tmp/large-transcript.md",
      destinationPath: "/tmp/copied-transcript.md",
    });

    expect(fixture.sourceText.length).toBeGreaterThan(LARGE_TOOL_RESULT_MIN_CHARS);
    expect(fixture.sourceText).toContain("Transcript Verification Fixture");
  });

  it("builds a prompt that instructs the agent to use write_large_tool_result", () => {
    const fixture = buildWriteLargeToolResultVerificationFixture({
      sourcePath: "/tmp/large-transcript.md",
      destinationPath: "/tmp/copied-transcript.md",
    });

    expect(fixture.prompt).toContain("write_large_tool_result");
    expect(fixture.prompt).toContain("/tmp/large-transcript.md");
    expect(fixture.prompt).toContain("/tmp/copied-transcript.md");
    expect(fixture.prompt).toContain("不要把全文放进 write.content");
  });
});
