export function normalizeSkillFilter(skillFilter?: ReadonlyArray<unknown>): string[] | undefined {
  if (skillFilter === undefined) {
    return undefined;
  }
  return skillFilter.map((entry) => String(entry).trim()).filter(Boolean);
}

export function normalizeSkillFilterForComparison(
  skillFilter?: ReadonlyArray<unknown>,
): string[] | undefined {
  const normalized = normalizeSkillFilter(skillFilter);
  if (normalized === undefined) {
    return undefined;
  }
  return Array.from(new Set(normalized)).toSorted();
}

export function matchesSkillFilter(
  cached?: ReadonlyArray<unknown>,
  next?: ReadonlyArray<unknown>,
): boolean {
  const cachedNormalized = normalizeSkillFilterForComparison(cached);
  const nextNormalized = normalizeSkillFilterForComparison(next);
  if (cachedNormalized === undefined || nextNormalized === undefined) {
    return cachedNormalized === nextNormalized;
  }
  if (cachedNormalized.length !== nextNormalized.length) {
    return false;
  }
  return cachedNormalized.every((entry, index) => entry === nextNormalized[index]);
}

export function mergeSkillFilters(
  primary?: ReadonlyArray<unknown>,
  secondary?: ReadonlyArray<unknown>,
): string[] | undefined {
  const normalizedPrimary = normalizeSkillFilter(primary);
  const normalizedSecondary = normalizeSkillFilter(secondary);
  if (!normalizedPrimary && !normalizedSecondary) {
    return undefined;
  }
  if (!normalizedPrimary) {
    return normalizedSecondary;
  }
  if (!normalizedSecondary) {
    return normalizedPrimary;
  }
  if (normalizedPrimary.length === 0 || normalizedSecondary.length === 0) {
    return [];
  }
  const secondarySet = new Set(normalizedSecondary);
  return normalizedPrimary.filter((name) => secondarySet.has(name));
}
