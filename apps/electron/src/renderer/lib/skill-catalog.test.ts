import { describe, expect, it } from "vitest";

import { recommendSkillNames, toSkillCatalogItems, type GatewaySkillStatusReport, type SkillCatalogItem } from "./skill-catalog";

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

describe("recommendSkillNames", () => {
  const items: SkillCatalogItem[] = [
    {
      id: "ads-core-ops",
      name: "ads-core-ops",
      description: "Ads ops.",
      source: "openclaw-bundled",
      sourceLabel: "Built-in",
      skillKey: "ads-core-ops",
      filePath: "/tmp/skills/ads-core-ops/SKILL.md",
      eligible: true,
      bundled: true,
      category: "Ads",
      installOptions: [],
      installed: true,
      canInstall: false,
    },
    {
      id: "hubspot",
      name: "hubspot",
      description: "HubSpot CRM.",
      source: "openclaw-bundled",
      sourceLabel: "Built-in",
      skillKey: "hubspot",
      filePath: "/tmp/skills/hubspot/SKILL.md",
      eligible: true,
      bundled: true,
      category: "CRM",
      installOptions: [],
      installed: true,
      canInstall: false,
    },
    {
      id: "zendesk",
      name: "zendesk",
      description: "Support CRM.",
      source: "openclaw-bundled",
      sourceLabel: "Built-in",
      skillKey: "zendesk",
      filePath: "/tmp/skills/zendesk/SKILL.md",
      eligible: true,
      bundled: true,
      category: "CRM",
      installOptions: [],
      installed: true,
      canInstall: false,
    },
    {
      id: "custom-skill",
      name: "custom-skill",
      description: "Custom.",
      source: "openclaw-workspace",
      sourceLabel: "Workspace",
      skillKey: "custom-skill",
      filePath: "/tmp/workspace/custom-skill/SKILL.md",
      eligible: true,
      bundled: false,
      category: "Uncategorized",
      installOptions: [],
      installed: true,
      canInstall: false,
    },
  ];

  it("returns the curated recommendation list in configured order", () => {
    expect(recommendSkillNames(items)).toEqual(["ads-core-ops", "hubspot", "zendesk"]);
  });

  it("supports limiting the initial preselected recommendation count", () => {
    expect(recommendSkillNames(items, { limit: 2 })).toEqual(["ads-core-ops", "hubspot"]);
  });
});
