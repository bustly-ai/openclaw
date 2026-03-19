import type { Skill } from "@mariozechner/pi-coding-agent";
import type {
  OpenClawSkillMetadata,
  ParsedSkillFrontmatter,
  SkillEntry,
  SkillInstallSpec,
  SkillInvocationPolicy,
  OpenClawSkillCommandHints,
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

function parseCommandHints(metadataObj: Record<string, unknown>): OpenClawSkillCommandHints | undefined {
  const aliases = normalizeStringList(metadataObj.aliases);
  const commandNamespace =
    typeof metadataObj.commandNamespace === "string" ? metadataObj.commandNamespace.trim() : "";
  const discoveryCommand =
    typeof metadataObj.discoveryCommand === "string" ? metadataObj.discoveryCommand.trim() : "";
  const defaultCommand =
    typeof metadataObj.defaultCommand === "string" ? metadataObj.defaultCommand.trim() : "";
  const fallbackCommand =
    typeof metadataObj.fallbackCommand === "string" ? metadataObj.fallbackCommand.trim() : "";
  const commandExamples = normalizeStringList(metadataObj.commandExamples);
  const runtimePackage =
    typeof metadataObj.runtimePackage === "string" ? metadataObj.runtimePackage.trim() : "";
  const runtimeVersion =
    typeof metadataObj.runtimeVersion === "string" ? metadataObj.runtimeVersion.trim() : "";
  const runtimeInstallSpec =
    typeof metadataObj.runtimeInstallSpec === "string" ? metadataObj.runtimeInstallSpec.trim() : "";
  const runtimeExecutable =
    typeof metadataObj.runtimeExecutable === "string" ? metadataObj.runtimeExecutable.trim() : "";
  const runtimeNotes = normalizeStringList(metadataObj.runtimeNotes);

  if (
    aliases.length === 0 &&
    !commandNamespace &&
    !discoveryCommand &&
    !defaultCommand &&
    !fallbackCommand &&
    commandExamples.length === 0 &&
    !runtimePackage &&
    !runtimeVersion &&
    !runtimeInstallSpec &&
    !runtimeExecutable &&
    runtimeNotes.length === 0
  ) {
    return undefined;
  }

  return {
    aliases: aliases.length > 0 ? aliases : undefined,
    commandNamespace: commandNamespace || undefined,
    discoveryCommand: discoveryCommand || undefined,
    defaultCommand: defaultCommand || undefined,
    fallbackCommand: fallbackCommand || undefined,
    commandExamples: commandExamples.length > 0 ? commandExamples : undefined,
    runtime:
      runtimePackage || runtimeVersion || runtimeInstallSpec || runtimeExecutable || runtimeNotes.length > 0
        ? {
            package: runtimePackage || undefined,
            version: runtimeVersion || undefined,
            installSpec: runtimeInstallSpec || undefined,
            executable: runtimeExecutable || undefined,
            notes: runtimeNotes.length > 0 ? runtimeNotes : undefined,
          }
        : undefined,
  };
}

function parseRuntimeNodePackageSpec(runtime: OpenClawSkillCommandHints["runtime"]): string | undefined {
  const installSpec = runtime?.installSpec?.trim();
  if (installSpec) {
    return installSpec.startsWith("npm:") ? installSpec.slice(4) : installSpec;
  }
  const pkg = runtime?.package?.trim();
  if (!pkg) {
    return undefined;
  }
  const version = runtime?.version?.trim();
  return version ? `${pkg}@${version}` : pkg;
}

function deriveRuntimeInstallSpec(commandHints?: OpenClawSkillCommandHints): SkillInstallSpec | undefined {
  const runtime = commandHints?.runtime;
  const packageSpec = parseRuntimeNodePackageSpec(runtime);
  if (!packageSpec) {
    return undefined;
  }
  return {
    id: "runtime-node",
    kind: "node",
    label: `Install ${packageSpec} runtime`,
    package: packageSpec,
    bins: runtime?.executable ? [runtime.executable] : undefined,
  };
}

function mergeRuntimeRequirements(
  requires: OpenClawSkillMetadata["requires"],
  commandHints?: OpenClawSkillCommandHints,
): OpenClawSkillMetadata["requires"] {
  const runtimeExecutable = commandHints?.runtime?.executable?.trim();
  if (!runtimeExecutable) {
    return requires;
  }

  const bins = Array.from(new Set([...(requires?.bins ?? []), runtimeExecutable]));
  return {
    bins,
    anyBins: requires?.anyBins ?? [],
    env: requires?.env ?? [],
    config: requires?.config ?? [],
  };
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
  const commandHints = parseCommandHints(metadataObj);
  const derivedRuntimeInstall = deriveRuntimeInstallSpec(commandHints);
  const mergedRequires = mergeRuntimeRequirements(requires, commandHints);
  return {
    always: typeof metadataObj.always === "boolean" ? metadataObj.always : undefined,
    emoji: typeof metadataObj.emoji === "string" ? metadataObj.emoji : undefined,
    homepage: typeof metadataObj.homepage === "string" ? metadataObj.homepage : undefined,
    skillKey: typeof metadataObj.skillKey === "string" ? metadataObj.skillKey : undefined,
    primaryEnv: typeof metadataObj.primaryEnv === "string" ? metadataObj.primaryEnv : undefined,
    os: osRaw.length > 0 ? osRaw : undefined,
    requires: mergedRequires,
    install:
      install.length > 0
        ? install
        : derivedRuntimeInstall
          ? [derivedRuntimeInstall]
          : undefined,
    commandHints,
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
