export const KNIP_ISSUE_CATEGORIES = [
  'files',
  'dependencies',
  'devDependencies',
  'unlisted',
  'binaries',
  'cycles',
] as const;

export type KnipIssueCategory = (typeof KNIP_ISSUE_CATEGORIES)[number];
export type KnipRatchetCounts = Readonly<Record<KnipIssueCategory, number>>;

export function evaluateKnipRatchet(
  current: KnipRatchetCounts,
  baseline: KnipRatchetCounts,
): string[] {
  return KNIP_ISSUE_CATEGORIES.flatMap((category) =>
    current[category] > baseline[category]
      ? [`${category} increased from ${baseline[category]} to ${current[category]}`]
      : [],
  );
}
