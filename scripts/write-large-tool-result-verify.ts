#!/usr/bin/env -S node --import tsx
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildWriteLargeToolResultVerificationFixture } from "../src/agents/tools/write-large-tool-result-verification.js";

function resolveOutputDir(): string {
  const requested = process.argv[2]?.trim();
  if (requested) {
    return path.resolve(requested);
  }
  return path.join(os.tmpdir(), "openclaw-write-large-tool-result-verify");
}

async function main() {
  const outputDir = resolveOutputDir();
  const sourcePath = path.join(outputDir, "large-transcript.md");
  const destinationPath = path.join(outputDir, "copied-transcript.md");
  const fixture = buildWriteLargeToolResultVerificationFixture({
    sourcePath,
    destinationPath,
  });

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(sourcePath, fixture.sourceText, "utf8");

  console.log(`Verification directory: ${outputDir}`);
  console.log(`Source file: ${sourcePath}`);
  console.log(`Destination file: ${destinationPath}`);
  console.log(`Source chars: ${fixture.sourceText.length}`);
  console.log("");
  console.log("Prompt to paste into the agent:");
  console.log("-----");
  console.log(fixture.prompt);
  console.log("-----");
  console.log("");
  console.log("Success criteria:");
  console.log("1. The agent reports it used read + write_large_tool_result");
  console.log("2. The destination file exists");
  console.log("3. The destination file content matches the source file");
}

main().catch((error) => {
  console.error(`Failed to create verification fixture: ${String(error)}`);
  process.exit(1);
});
