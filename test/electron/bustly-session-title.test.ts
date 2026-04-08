import { describe, expect, it } from "vitest";
import {
  normalizeGeneratedSessionTitle,
  normalizeSampleRouteKey,
  normalizeSessionPromptExcerpt,
} from "../../apps/electron/src/shared/bustly-session-title.js";

describe("bustly-session-title helpers", () => {
  it("normalizes prompt excerpts and trims to the supported size", () => {
    const longPrompt = `   First task\n\n${"x".repeat(2_500)}   `;
    const normalized = normalizeSessionPromptExcerpt(longPrompt);

    expect(normalized.startsWith("First task")).toBe(true);
    expect(normalized.length).toBe(2_000);
  });

  it("keeps only supported sample route keys", () => {
    expect(normalizeSampleRouteKey("bustly/chat.advanced")).toBe("chat.advanced");
    expect(normalizeSampleRouteKey("chat.ultra")).toBe("chat.ultra");
    expect(normalizeSampleRouteKey("chat.lite")).toBe("chat.standard");
  });

  it("sanitizes generated titles before they are written back", () => {
    expect(normalizeGeneratedSessionTitle('  标题： "月度广告复盘"\n更多解释  ')).toBe("月度广告复盘");
    expect(normalizeGeneratedSessionTitle("New conversation")).toBeNull();
    expect(normalizeGeneratedSessionTitle("")).toBeNull();
  });
});
