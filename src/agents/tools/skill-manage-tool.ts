import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
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
    throw new ToolInputError(
      "skillName must match ^[a-z0-9][a-z0-9_-]{0,63}$ and stay path-safe.",
    );
  }
  return trimmed;
}

function resolveSkillRoot(workspaceDir: string, skillName: string): string {
  return path.resolve(workspaceDir, "skills", validateSkillName(skillName));
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

export function createSkillManageTool(opts?: { workspaceDir?: string }): AnyAgentTool | null {
  const workspaceDir = opts?.workspaceDir?.trim();
  if (!workspaceDir) {
    return null;
  }

  return {
    label: "Skill Manage",
    name: "skill_manage",
    description:
      "Create, update, or delete workspace skills under skills/<skillName>/ for reusable procedures. Prefer durable procedures here; keep facts/preferences in memory.",
    parameters: SkillManageSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const skillName = validateSkillName(
        readStringParam(params, "skillName", { required: true, label: "skillName" }),
      );
      const skillDir = resolveSkillRoot(workspaceDir, skillName);
      const skillFile = path.join(skillDir, "SKILL.md");

      if (action === "delete") {
        await fs.rm(skillDir, { recursive: true, force: true });
        return jsonResult({
          status: "deleted",
          skillName,
          skillDir,
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

      return jsonResult({
        status: "updated",
        skillName,
        skillDir,
        skillFile,
        filesWritten,
      });
    },
  };
}
