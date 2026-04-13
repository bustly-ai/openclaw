import { describe, expect, it } from "vitest";

import { toSkillCatalogItems, type GatewaySkillStatusReport } from "./skill-catalog";

describe("toSkillCatalogItems", () => {
  it("uses supabase sub_layer matched by skillKey slug", () => {
    const report: GatewaySkillStatusReport = {
      scope: "global",
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "DOCX",
          description: "Create and edit DOCX files.",
          source: "openclaw-bundled",
          skillKey: "docx",
          filePath: "/tmp/workspace/docx/SKILL.md",
          eligible: true,
          bundled: true,
        },
      ],
    };

    const items = toSkillCatalogItems(report, {
      categoryLookup: {
        bySlug: new Map([["docx", "Automation"]]),
        byName: new Map(),
      },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe("Automation");
    expect(items[0]?.sourceLabel).toBe("Built-in");
  });

  it("keeps business category separate from setup state and falls back to name matching", () => {
    const report: GatewaySkillStatusReport = {
      scope: "global",
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "Zendesk",
          description: "CRM workflows.",
          source: "openclaw-managed",
          skillKey: "zendesk-local",
          filePath: "/tmp/skills/zendesk/SKILL.md",
          eligible: false,
        },
        {
          name: "Unknown Skill",
          description: "Custom local skill.",
          source: "openclaw-workspace",
          skillKey: "unknown-skill",
          filePath: "/tmp/workspace/unknown-skill/SKILL.md",
          eligible: true,
        },
      ],
    };

    const items = toSkillCatalogItems(report, {
      categoryLookup: {
        bySlug: new Map(),
        byName: new Map([["zendesk", "CRM"]]),
      },
    });

    expect(items.map((item) => item.name)).toEqual(["Zendesk", "Unknown Skill"]);
    expect(items[0]?.category).toBe("CRM");
    expect(items[0]?.eligible).toBe(false);
    expect(items[1]?.category).toBe("Uncategorized");
  });
});
