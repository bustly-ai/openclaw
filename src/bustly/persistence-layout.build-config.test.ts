import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tsdownConfig from "../../tsdown.config.ts";

describe("persistence layout build config", () => {
  it("includes persistence-layout as a build entry", () => {
    const entries = tsdownConfig.flatMap((config) => {
      const entry = config.entry;
      return Array.isArray(entry) ? entry : [entry];
    });

    expect(entries).toContain("src/bustly/persistence-layout.ts");
  });

  it("uses the built persistence-layout entrypoint path at container startup", () => {
    const entrypoint = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/cloud/ecs/runtime-entrypoint.sh"),
      "utf8",
    );

    expect(entrypoint).toContain("node dist/persistence-layout.js");
    expect(entrypoint).not.toContain("node dist/bustly/persistence-layout.js");
  });
});
