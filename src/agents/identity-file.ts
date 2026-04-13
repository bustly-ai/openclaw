import fs from "node:fs";
import path from "node:path";
import { DEFAULT_IDENTITY_FILENAME } from "./workspace.js";

export type AgentIdentityFile = {
  name?: string;
  emoji?: string;
  theme?: string;
  creature?: string;
  vibe?: string;
  avatar?: string;
};

type MarkdownSectionRange = {
  headingIndex: number;
  bodyStartIndex: number;
  endIndex: number;
};

const IDENTITY_PLACEHOLDER_VALUES = new Set([
  "pick something you like",
  "ai? robot? familiar? ghost in the machine? something weirder?",
  "how do you come across? sharp? warm? chaotic? calm?",
  "your signature - pick one that feels right",
  "workspace-relative path, http(s) url, or data uri",
]);

function normalizeIdentityValue(value: string): string {
  let normalized = value.trim();
  normalized = normalized.replace(/^[*_]+|[*_]+$/g, "").trim();
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/[\u2013\u2014]/g, "-");
  normalized = normalized.replace(/\s+/g, " ").toLowerCase();
  return normalized;
}

function isIdentityPlaceholder(value: string): boolean {
  const normalized = normalizeIdentityValue(value);
  return IDENTITY_PLACEHOLDER_VALUES.has(normalized);
}

function normalizeMarkdownContent(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function trimLeadingBlankLines(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && !lines[start]?.trim()) {
    start += 1;
  }
  return lines.slice(start);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && !lines[end - 1]?.trim()) {
    end -= 1;
  }
  return lines.slice(0, end);
}

function findMarkdownSectionRange(lines: string[], heading: string): MarkdownSectionRange | null {
  const headingPattern = new RegExp(`^#{1,6}\\s+${heading}\\s*$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    if (!headingPattern.test(lines[index]?.trim() ?? "")) {
      continue;
    }
    let endIndex = lines.length;
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      if (/^#{1,6}\s+\S/.test(lines[nextIndex]?.trim() ?? "")) {
        endIndex = nextIndex;
        break;
      }
    }
    return {
      headingIndex: index,
      bodyStartIndex: index + 1,
      endIndex,
    };
  }
  return null;
}

function splitMarkdownBody(value: string): string[] {
  return normalizeMarkdownContent(value)
    .trim()
    .split("\n")
    .map((line) => line.trimEnd());
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseIdentityMarkdown(content: string): AgentIdentityFile {
  const identity: AgentIdentityFile = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const cleaned = line.trim().replace(/^\s*-\s*/, "");
    const colonIndex = cleaned.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const label = cleaned.slice(0, colonIndex).replace(/[*_]/g, "").trim().toLowerCase();
    const value = cleaned
      .slice(colonIndex + 1)
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    if (!value) {
      continue;
    }
    if (isIdentityPlaceholder(value)) {
      continue;
    }
    if (label === "name") {
      identity.name = value;
    }
    if (label === "emoji") {
      identity.emoji = value;
    }
    if (label === "creature") {
      identity.creature = value;
    }
    if (label === "vibe") {
      identity.vibe = value;
    }
    if (label === "theme") {
      identity.theme = value;
    }
    if (label === "avatar") {
      identity.avatar = value;
    }
  }
  return identity;
}

export function identityHasValues(identity: AgentIdentityFile): boolean {
  return Boolean(
    identity.name ||
    identity.emoji ||
    identity.theme ||
    identity.creature ||
    identity.vibe ||
    identity.avatar,
  );
}

export function extractIdentityMission(content: string): string | null {
  const lines = normalizeMarkdownContent(content).split("\n");
  const range = findMarkdownSectionRange(lines, "Mission");
  if (!range) {
    return null;
  }
  const body = lines.slice(range.bodyStartIndex, range.endIndex).join("\n").trim();
  return body ? body : null;
}

export function upsertIdentityMission(content: string, mission: string): string {
  const normalizedContent = normalizeMarkdownContent(content);
  const normalizedMission = mission.trim();
  if (!normalizedMission) {
    return ensureTrailingNewline(normalizedContent.trimEnd());
  }

  const bodyLines = splitMarkdownBody(normalizedMission);
  const lines = normalizedContent.split("\n");
  const range = findMarkdownSectionRange(lines, "Mission");
  if (range) {
    const before = trimTrailingBlankLines(lines.slice(0, range.headingIndex + 1));
    const after = trimLeadingBlankLines(lines.slice(range.endIndex));
    const nextLines = [...before, "", ...bodyLines];
    if (after.length > 0) {
      nextLines.push("", ...after);
    }
    return ensureTrailingNewline(nextLines.join("\n"));
  }

  const insertIndex = lines.findIndex((line) => /^#{1,6}\s+(Default Traits|Notes)\s*$/i.test(line.trim()));
  const before = trimTrailingBlankLines(insertIndex === -1 ? lines : lines.slice(0, insertIndex));
  const after = insertIndex === -1 ? [] : trimLeadingBlankLines(lines.slice(insertIndex));
  const nextLines = [...before];
  if (nextLines.length > 0) {
    nextLines.push("");
  }
  nextLines.push("## Mission", "", ...bodyLines);
  if (after.length > 0) {
    nextLines.push("", ...after);
  }
  return ensureTrailingNewline(nextLines.join("\n"));
}

export function upsertIdentityField(content: string, label: string, value: string): string {
  const normalizedContent = normalizeMarkdownContent(content);
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return ensureTrailingNewline(normalizedContent.trimEnd());
  }

  const replacement = `- ${label}: ${normalizedValue}`;
  const fieldPattern = new RegExp(
    `^\\s*-\\s*(?:\\*\\*)?${escapeForRegex(label)}(?:\\*\\*)?\\s*:\\s*.*$`,
    "i",
  );
  const lines = normalizedContent.split("\n");
  const lineIndex = lines.findIndex((line) => fieldPattern.test(line.trim()));
  if (lineIndex >= 0) {
    const nextLines = [...lines];
    nextLines[lineIndex] = replacement;
    return ensureTrailingNewline(nextLines.join("\n").trimEnd());
  }

  const insertIndex = lines.findIndex((line, index) => index > 0 && /^#{2,6}\s+\S/.test(line.trim()));
  const before = trimTrailingBlankLines(insertIndex === -1 ? lines : lines.slice(0, insertIndex));
  const after = insertIndex === -1 ? [] : trimLeadingBlankLines(lines.slice(insertIndex));
  const nextLines = [...before];
  if (nextLines.length > 0) {
    nextLines.push("");
  }
  nextLines.push(replacement);
  if (after.length > 0) {
    nextLines.push("", ...after);
  }
  return ensureTrailingNewline(nextLines.join("\n"));
}

export function loadIdentityFromFile(identityPath: string): AgentIdentityFile | null {
  try {
    const content = fs.readFileSync(identityPath, "utf-8");
    const parsed = parseIdentityMarkdown(content);
    if (!identityHasValues(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadAgentIdentityFromWorkspace(workspace: string): AgentIdentityFile | null {
  const identityPath = path.join(workspace, DEFAULT_IDENTITY_FILENAME);
  return loadIdentityFromFile(identityPath);
}
