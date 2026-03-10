export type InputArtifactKind = "file" | "directory" | "image";

export type ChatInputArtifact = {
  kind: InputArtifactKind;
  name: string;
  path?: string;
};

const INPUT_ARTIFACTS_HEADER = "";
const INPUT_ARTIFACTS_FENCE = "file";
const IMAGE_FILE_RE = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|tiff|webp)$/i;

export function inferInputArtifactKind(params: {
  kind?: "file" | "directory";
  name?: string;
  path?: string;
}): InputArtifactKind {
  if (params.kind === "directory") {
    return "directory";
  }
  const probe = `${params.name ?? ""} ${params.path ?? ""}`;
  return IMAGE_FILE_RE.test(probe) ? "image" : "file";
}

export function buildInputArtifactsMessage(message: string, artifacts: ChatInputArtifact[]): string {
  if (artifacts.length === 0) {
    return message;
  }
  const serialized = JSON.stringify(artifacts, null, 2);
  const block = `${INPUT_ARTIFACTS_HEADER}\n\`\`\`${INPUT_ARTIFACTS_FENCE}\n${serialized}\n\`\`\``;
  return message.trim().length > 0 ? `${message}\n\n${block}` : block;
}

export function parseInputArtifactsFromMessage(message: string): {
  text: string;
  artifacts: ChatInputArtifact[];
} {
  const escapedFence = escapeRegex(INPUT_ARTIFACTS_FENCE);
  const escapedHeader = INPUT_ARTIFACTS_HEADER ? escapeRegex(INPUT_ARTIFACTS_HEADER) : "";
  const pattern = escapedHeader
    ? new RegExp(`(?:\\n{2,}|^)${escapedHeader}\\s*\`\`\`${escapedFence}\\s*([\\s\\S]*?)\\s*\`\`\`\\s*$`)
    : new RegExp(`(?:\\s|^)\`\`\`${escapedFence}\\s*([\\s\\S]*?)\\s*\`\`\`\\s*$`);
  const match = pattern.exec(message);
  if (!match) {
    return { text: message, artifacts: [] };
  }
  const rawJson = match[1]?.trim();
  const parsed = safeParseArtifacts(rawJson);
  const text = message.slice(0, match.index).replace(/\s+$/, "");
  return { text, artifacts: parsed };
}

function safeParseArtifacts(rawJson: string | undefined): ChatInputArtifact[] {
  if (!rawJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry) => normalizeArtifact(entry));
  } catch {
    return [];
  }
}

function normalizeArtifact(entry: unknown): ChatInputArtifact[] {
  if (!entry || typeof entry !== "object") {
    return [];
  }
  const rec = entry as Record<string, unknown>;
  const kind = rec.kind;
  const name = rec.name;
  const path = rec.path;
  if (
    (kind !== "file" && kind !== "directory" && kind !== "image") ||
    typeof name !== "string" ||
    !name.trim()
  ) {
    return [];
  }
  return [
    {
      kind,
      name: name.trim(),
      path: typeof path === "string" && path.trim() ? path.trim() : undefined,
    },
  ];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
