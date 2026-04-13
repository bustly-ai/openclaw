import { describe, expect, it } from "vitest";
import {
  extractIdentityMission,
  parseIdentityMarkdown,
  upsertIdentityField,
  upsertIdentityMission,
} from "./identity-file.js";

describe("parseIdentityMarkdown", () => {
  it("ignores identity template placeholders", () => {
    const content = `
# IDENTITY.md - Who Am I?

- **Name:** *(pick something you like)*
- **Creature:** *(AI? robot? familiar? ghost in the machine? something weirder?)*
- **Vibe:** *(how do you come across? sharp? warm? chaotic? calm?)*
- **Emoji:** *(your signature - pick one that feels right)*
- **Avatar:** *(workspace-relative path, http(s) URL, or data URI)*
`;
    const parsed = parseIdentityMarkdown(content);
    expect(parsed).toEqual({});
  });

  it("parses explicit identity values", () => {
    const content = `
- **Name:** Samantha
- **Creature:** Robot
- **Vibe:** Warm
- **Emoji:** :robot:
- **Avatar:** avatars/openclaw.png
`;
    const parsed = parseIdentityMarkdown(content);
    expect(parsed).toEqual({
      name: "Samantha",
      creature: "Robot",
      vibe: "Warm",
      emoji: ":robot:",
      avatar: "avatars/openclaw.png",
    });
  });

  it("extracts the Mission section as description text", () => {
    const content = `# IDENTITY.md - Agent Identity

- Name: Samantha

## Mission

Help operators spot issues early and turn them into concrete actions.

## Default Traits

- Calm
`;

    expect(extractIdentityMission(content)).toBe(
      "Help operators spot issues early and turn them into concrete actions.",
    );
  });

  it("updates the Mission section while preserving adjacent sections", () => {
    const content = `# IDENTITY.md - Agent Identity

- Name: Samantha

## Mission

Old mission text.

## Default Traits

- Calm
`;

    expect(upsertIdentityMission(content, "New mission line one.\n\nNew mission line two.")).toBe(
      [
        "# IDENTITY.md - Agent Identity",
        "",
        "- Name: Samantha",
        "",
        "## Mission",
        "",
        "New mission line one.",
        "",
        "New mission line two.",
        "",
        "## Default Traits",
        "",
        "- Calm",
        "",
      ].join("\n"),
    );
  });

  it("inserts a Mission section when one is missing", () => {
    const content = `# IDENTITY.md - Agent Identity

- Name: Samantha

## Default Traits

- Calm
`;

    expect(upsertIdentityMission(content, "Describe the agent here.")).toBe(
      [
        "# IDENTITY.md - Agent Identity",
        "",
        "- Name: Samantha",
        "",
        "## Mission",
        "",
        "Describe the agent here.",
        "",
        "## Default Traits",
        "",
        "- Calm",
        "",
      ].join("\n"),
    );
  });

  it("updates an existing identity field without rewriting the rest of the file", () => {
    const content = `# IDENTITY.md - Agent Identity

- **Name:** Samantha
- Role: Commerce Operating Agent

## Mission

Mission text.
`;

    expect(upsertIdentityField(content, "Name", "Nova")).toBe(
      [
        "# IDENTITY.md - Agent Identity",
        "",
        "- Name: Nova",
        "- Role: Commerce Operating Agent",
        "",
        "## Mission",
        "",
        "Mission text.",
        "",
      ].join("\n"),
    );
  });
});
