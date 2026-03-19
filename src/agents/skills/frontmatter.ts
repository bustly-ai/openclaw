import type { Skill } from "@mariozechner/pi-coding-agent";
import type {
  SkillCommandHints,
  SkillCommandRuntimeSpec,
  OpenClawSkillMetadata,
  ParsedSkillFrontmatter,
  SkillEntry,
  SkillInstallSpec,
  SkillInvocationPolicy,
} from "./types.js";
import { parseFrontmatterBlock } from "../../markdown/frontmatter.js";
import {
  getFrontmatterString,
  normalizeStringList,
  parseOpenClawManifestInstallBase,
  parseFrontmatterBool,
  resolveOpenClawManifestBlock,
  resolveOpenClawManifestInstall,
  resolveOpenClawManifestOs,
  resolveOpenClawManifestRequires,
} from "../../shared/frontmatter.js";

export function parseFrontmatter(content: string): ParsedSkillFrontmatter {
  return parseFrontmatterBlock(content);
}

function parseInstallSpec(input: unknown): SkillInstallSpec | undefined {
  const parsed = parseOpenClawManifestInstallBase(input, ["brew", "node", "go", "uv", "download"]);
  if (!parsed) {
    return undefined;
  }
  const { raw } = parsed;
  const spec: SkillInstallSpec = {
    kind: parsed.kind as SkillInstallSpec["kind"],
  };

  if (parsed.id) {
    spec.id = parsed.id;
  }
  if (parsed.label) {
    spec.label = parsed.label;
  }
  if (parsed.bins) {
    spec.bins = parsed.bins;
  }
  const osList = normalizeStringList(raw.os);
  if (osList.length > 0) {
    spec.os = osList;
  }
  const formula = typeof raw.formula === "string" ? raw.formula.trim() : "";
  if (formula) {
    spec.formula = formula;
  }
  const cask = typeof raw.cask === "string" ? raw.cask.trim() : "";
  if (!spec.formula && cask) {
    spec.formula = cask;
  }
  if (typeof raw.package === "string") {
    spec.package = raw.package;
  }
  if (typeof raw.module === "string") {
    spec.module = raw.module;
  }
  if (typeof raw.url === "string") {
    spec.url = raw.url;
  }
  if (typeof raw.archive === "string") {
    spec.archive = raw.archive;
  }
  if (typeof raw.extract === "boolean") {
    spec.extract = raw.extract;
  }
  if (typeof raw.stripComponents === "number") {
    spec.stripComponents = raw.stripComponents;
  }
  if (typeof raw.targetDir === "string") {
    spec.targetDir = raw.targetDir;
  }

  return spec;
}

function resolveCommandRuntime(metadataObj: Record<string, unknown>): SkillCommandRuntimeSpec | undefined {
  const commandHintsRaw =
    typeof metadataObj.commandHints === "object" && metadataObj.commandHints !== null
      ? (metadataObj.commandHints as Record<string, unknown>)
      : undefined;
  const runtimeRaw =
    typeof commandHintsRaw?.runtime === "object" && commandHintsRaw.runtime !== null
      ? (commandHintsRaw.runtime as Record<string, unknown>)
      : metadataObj;

  const runtime: SkillCommandRuntimeSpec = {};
  const packageName =
    typeof runtimeRaw.package === "string"
      ? runtimeRaw.package.trim()
      : typeof metadataObj.runtimePackage === "string"
        ? metadataObj.runtimePackage.trim()
        : "";
  if (packageName) {
    runtime.package = packageName;
  }

  const version =
    typeof runtimeRaw.version === "string"
      ? runtimeRaw.version.trim()
      : typeof metadataObj.runtimeVersion === "string"
        ? metadataObj.runtimeVersion.trim()
        : "";
  if (version) {
    runtime.version = version;
  }

  const installSpec =
    typeof runtimeRaw.installSpec === "string"
      ? runtimeRaw.installSpec.trim()
      : typeof metadataObj.runtimeInstallSpec === "string"
        ? metadataObj.runtimeInstallSpec.trim()
        : "";
  if (installSpec) {
    runtime.installSpec = installSpec;
  }

  const executable =
    typeof runtimeRaw.executable === "string"
      ? runtimeRaw.executable.trim()
      : typeof metadataObj.runtimeExecutable === "string"
        ? metadataObj.runtimeExecutable.trim()
        : "";
  if (executable) {
    runtime.executable = executable;
  }

  const notes = normalizeStringList(runtimeRaw.notes ?? metadataObj.runtimeNotes);
  if (notes.length > 0) {
    runtime.notes = notes;
  }

  return Object.keys(runtime).length > 0 ? runtime : undefined;
}

function resolveCommandHints(metadataObj: Record<string, unknown>): SkillCommandHints | undefined {
  const commandHintsRaw =
    typeof metadataObj.commandHints === "object" && metadataObj.commandHints !== null
      ? (metadataObj.commandHints as Record<string, unknown>)
      : undefined;
  const hints: SkillCommandHints = {};

  const aliases = normalizeStringList(commandHintsRaw?.aliases ?? metadataObj.aliases);
  if (aliases.length > 0) {
    hints.aliases = aliases;
  }

  const commandNamespace =
    typeof commandHintsRaw?.commandNamespace === "string"
      ? commandHintsRaw.commandNamespace.trim()
      : typeof metadataObj.commandNamespace === "string"
        ? metadataObj.commandNamespace.trim()
        : "";
  if (commandNamespace) {
    hints.commandNamespace = commandNamespace;
  }

  for (const key of ["discoveryCommand", "defaultCommand", "fallbackCommand"] as const) {
    const value =
      typeof commandHintsRaw?.[key] === "string"
        ? String(commandHintsRaw[key]).trim()
        : typeof metadataObj[key] === "string"
          ? String(metadataObj[key]).trim()
          : "";
    if (value) {
      hints[key] = value;
    }
  }

  const commandExamples = normalizeStringList(
    commandHintsRaw?.commandExamples ?? metadataObj.commandExamples,
  );
  if (commandExamples.length > 0) {
    hints.commandExamples = commandExamples;
  }

  const runtime = resolveCommandRuntime(metadataObj);
  if (runtime) {
    hints.runtime = runtime;
  }

  return Object.keys(hints).length > 0 ? hints : undefined;
}

export function resolveOpenClawMetadata(
  frontmatter: ParsedSkillFrontmatter,
): OpenClawSkillMetadata | undefined {
  const metadataObj = resolveOpenClawManifestBlock({ frontmatter });
  if (!metadataObj) {
    return undefined;
  }
  const requires = resolveOpenClawManifestRequires(metadataObj);
  const install = resolveOpenClawManifestInstall(metadataObj, parseInstallSpec);
  const osRaw = resolveOpenClawManifestOs(metadataObj);
  return {
    always: typeof metadataObj.always === "boolean" ? metadataObj.always : undefined,
    emoji: typeof metadataObj.emoji === "string" ? metadataObj.emoji : undefined,
    homepage: typeof metadataObj.homepage === "string" ? metadataObj.homepage : undefined,
    skillKey: typeof metadataObj.skillKey === "string" ? metadataObj.skillKey : undefined,
    primaryEnv: typeof metadataObj.primaryEnv === "string" ? metadataObj.primaryEnv : undefined,
    os: osRaw.length > 0 ? osRaw : undefined,
    requires: requires,
    install: install.length > 0 ? install : undefined,
    commandHints: resolveCommandHints(metadataObj),
  };
}

export function resolveSkillInvocationPolicy(
  frontmatter: ParsedSkillFrontmatter,
): SkillInvocationPolicy {
  return {
    userInvocable: parseFrontmatterBool(getFrontmatterString(frontmatter, "user-invocable"), true),
    disableModelInvocation: parseFrontmatterBool(
      getFrontmatterString(frontmatter, "disable-model-invocation"),
      false,
    ),
  };
}

export function resolveSkillKey(skill: Skill, entry?: SkillEntry): string {
  return entry?.metadata?.skillKey ?? skill.name;
}
