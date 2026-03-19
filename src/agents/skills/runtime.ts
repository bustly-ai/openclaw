import type {
  SkillCommandRuntimeSpec,
  SkillEntry,
  SkillInstallSpec,
} from "./types.js";

function normalizePackageSpec(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("npm:")) {
    return trimmed.slice("npm:".length).trim() || undefined;
  }
  if (trimmed.startsWith("node:")) {
    return trimmed.slice("node:".length).trim() || undefined;
  }
  return undefined;
}

export function resolveSkillRuntime(entry: SkillEntry): SkillCommandRuntimeSpec | undefined {
  return entry.metadata?.commandHints?.runtime;
}

export function resolveRuntimeInstallSpec(
  runtime: SkillCommandRuntimeSpec | undefined,
): SkillInstallSpec | undefined {
  const installSpec = normalizePackageSpec(runtime?.installSpec ?? "");
  if (!installSpec) {
    return undefined;
  }

  const bins = runtime?.executable?.trim() ? [runtime.executable.trim()] : undefined;
  return {
    id: "runtime",
    kind: "node",
    package: installSpec,
    ...(bins ? { bins } : {}),
  };
}

export function resolveSkillInstallSpecs(entry: SkillEntry): SkillInstallSpec[] {
  const install = entry.metadata?.install ?? [];
  const runtimeInstall = resolveRuntimeInstallSpec(resolveSkillRuntime(entry));
  if (!runtimeInstall) {
    return install;
  }

  const alreadyPresent = install.some((spec, index) => {
    const id = (spec.id ?? `${spec.kind}-${index}`).trim();
    return id === runtimeInstall.id;
  });
  if (alreadyPresent) {
    return install;
  }
  return [...install, runtimeInstall];
}

function normalizeLookupValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function resolveOpsLookupNames(entry: SkillEntry): string[] {
  const aliases = entry.metadata?.commandHints?.aliases ?? [];
  return [entry.skill.name, entry.metadata?.skillKey ?? "", ...aliases]
    .map((value) => value.trim())
    .filter(Boolean);
}

export function matchesOpsSkillLookup(entry: SkillEntry, rawName: string): boolean {
  const target = normalizeLookupValue(rawName);
  if (!target) {
    return false;
  }
  return resolveOpsLookupNames(entry).some((candidate) => normalizeLookupValue(candidate) === target);
}
