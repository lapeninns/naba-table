export const QA_TEST_TAGS = [
  '@a11y',
  '@api',
  '@browser',
  '@contract',
  '@destructive',
  '@dry-run-only',
  '@external-mock',
  '@local-only',
  '@observability',
  '@p0',
  '@p1',
  '@p2',
  '@p3',
  '@performance',
  '@security',
  '@smoke',
  '@staging-ok',
  '@visual',
  '@worker',
] as const;

export type QaTestTag = (typeof QA_TEST_TAGS)[number];

const QA_TEST_TAG_SET = new Set<string>(QA_TEST_TAGS);

export function validateQaTags(tags: readonly string[]): QaTestTag[] {
  return tags.map((tag) => {
    if (!tag.startsWith('@')) {
      throw new Error(`QA test tag "${tag}" must start with @.`);
    }
    if (!QA_TEST_TAG_SET.has(tag)) {
      throw new Error(`Unknown QA test tag "${tag}". Add it to scripts/qa/tags.ts first.`);
    }
    return tag as QaTestTag;
  });
}

export function qaTitle(title: string, tags: readonly QaTestTag[]): string {
  return `${tags.join(' ')} ${title}`;
}
