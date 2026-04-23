import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { CONFIG_DIR } from "../../utils.js";
import {
  loadBustlyAgentMetadata,
  resolveBustlyAgentMetadataPath,
  saveBustlyAgentMetadata,
} from "../bustly-agent-metadata.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam, ToolInputError } from "./common.js";

const SkillSupportFileSchema = Type.Object({
  path: Type.String(),
  content: Type.String(),
});

const SkillManageSchema = Type.Object({
  action: Type.String(),
  skillName: Type.String(),
  description: Type.Optional(Type.String()),
  body: Type.Optional(Type.String()),
  frontmatterExtra: Type.Optional(Type.String()),
  supportFiles: Type.Optional(Type.Array(SkillSupportFileSchema)),
});

const SAFE_SKILL_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function validateSkillName(skillName: string): string {
  const trimmed = skillName.trim();
  if (!SAFE_SKILL_NAME_RE.test(trimmed)) {
    throw new ToolInputError("skillName must match ^[a-z0-9][a-z0-9_-]{0,63}$ and stay path-safe.");
  }
  return trimmed;
}

function resolveSkillRoot(managedSkillsDir: string, skillName: string): string {
  return path.resolve(managedSkillsDir, validateSkillName(skillName));
}

function resolveSupportFilePath(skillDir: string, relPath: string): string {
  const normalized = relPath.trim().replaceAll("\\", "/");
  if (!normalized) {
    throw new ToolInputError("supportFiles.path required");
  }
  if (
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new ToolInputError(`supportFiles.path must stay within the skill directory: ${relPath}`);
  }
  if (normalized === "SKILL.md") {
    throw new ToolInputError("supportFiles.path cannot overwrite SKILL.md");
  }
  const resolved = path.resolve(skillDir, normalized);
  const relative = path.relative(skillDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ToolInputError(`supportFiles.path escapes the skill directory: ${relPath}`);
  }
  return resolved;
}

function buildSkillMarkdown(params: {
  skillName: string;
  description: string;
  body: string;
  frontmatterExtra?: string;
}): string {
  const frontmatter = [
    `name: ${params.skillName}`,
    `description: ${params.description.trim()}`,
    params.frontmatterExtra?.trim() ?? "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
  const body = params.body.trim() || `# ${params.skillName}`;
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

function upsertSkillInAgentMetadata(workspaceDir: string, skillName: string): string[] {
  const current = loadBustlyAgentMetadata(workspaceDir);
  const nextSkills = Array.from(new Set([...(current.skills ?? []), skillName])).toSorted();
  const saved = saveBustlyAgentMetadata(workspaceDir, {
    ...current,
    skills: nextSkills,
  });
  return saved.skills ?? [];
}

function removeSkillFromAgentMetadata(
  workspaceDir: string,
  skillName: string,
): string[] | undefined {
  const current = loadBustlyAgentMetadata(workspaceDir);
  if (!Array.isArray(current.skills)) {
    return current.skills;
  }
  const nextSkills = current.skills.filter((entry) => entry !== skillName);
  const saved = saveBustlyAgentMetadata(workspaceDir, {
    ...current,
    skills: nextSkills.length > 0 ? nextSkills : undefined,
  });
  return saved.skills;
}

export function createSkillManageTool(opts?: {
  workspaceDir?: string;
  managedSkillsDir?: string;
}): AnyAgentTool | null {
  const workspaceDir = opts?.workspaceDir?.trim();
  if (!workspaceDir) {
    return null;
  }
  const managedSkillsDir = path.resolve(
    opts?.managedSkillsDir?.trim() || path.join(CONFIG_DIR, "skills"),
  );

  return {
    label: "Skill Manage",
    name: "skill_manage",
    description:
      "Create, update, or delete managed skills under ~/.bustly/skills/<skillName> for reusable procedures, then sync this agent's skill filter in .bustly-agent.json.",
    parameters: SkillManageSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const skillName = validateSkillName(
        readStringParam(params, "skillName", { required: true, label: "skillName" }),
      );
      const skillDir = resolveSkillRoot(managedSkillsDir, skillName);
      const skillFile = path.join(skillDir, "SKILL.md");
      const metadataPath = resolveBustlyAgentMetadataPath(workspaceDir);

      if (action === "delete") {
        await fs.rm(skillDir, { recursive: true, force: true });
        const agentSkills = removeSkillFromAgentMetadata(workspaceDir, skillName);
        return jsonResult({
          status: "deleted",
          skillName,
          skillDir,
          metadataPath,
          agentSkills,
          deleted: true,
        });
      }

      if (action !== "upsert") {
        throw new ToolInputError('action must be "upsert" or "delete"');
      }

      const description = readStringParam(params, "description", {
        required: true,
        label: "description",
      });
      const body = readStringParam(params, "body", {
        required: true,
        label: "body",
        trim: false,
      });
      const frontmatterExtra = readStringParam(params, "frontmatterExtra", {
        trim: false,
      });
      const supportFilesRaw = Array.isArray(params.supportFiles) ? params.supportFiles : [];

      await fs.mkdir(skillDir, { recursive: true });
      const filesWritten = ["SKILL.md"];
      await fs.writeFile(
        skillFile,
        buildSkillMarkdown({
          skillName,
          description,
          body,
          frontmatterExtra,
        }),
        "utf-8",
      );

      for (const file of supportFilesRaw) {
        if (!file || typeof file !== "object") {
          continue;
        }
        const relPath = readStringParam(file as Record<string, unknown>, "path", {
          required: true,
          label: "supportFiles.path",
        });
        const content = readStringParam(file as Record<string, unknown>, "content", {
          required: true,
          label: "supportFiles.content",
          trim: false,
          allowEmpty: true,
        });
        const resolved = resolveSupportFilePath(skillDir, relPath);
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, content, "utf-8");
        filesWritten.push(path.relative(skillDir, resolved).replaceAll(path.sep, "/"));
      }
      const agentSkills = upsertSkillInAgentMetadata(workspaceDir, skillName);

      return jsonResult({
        status: "updated",
        skillName,
        managedSkillsDir,
        skillDir,
        skillFile,
        metadataPath,
        agentSkills,
        filesWritten,
      });
    },
  };
}
