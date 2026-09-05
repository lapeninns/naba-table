import type { TestInventoryDetail } from '../executor/types';

/**
 * Minimal JUnit XML reader (no dependencies, never evaluates anything).
 *
 * It only looks at `<testcase>` elements and their `<failure>`, `<error>` and
 * `<skipped>` children, which is all Vitest's junit reporter and the worker
 * reporters emit. Malformed XML degrades to "no cases", never to a crash.
 */

export const MAX_TEST_IDS = 50_000;

const ENTITIES: Readonly<Record<string, string>> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/gu, (entity) => {
    if (entity in ENTITIES) return ENTITIES[entity];
    const code = entity.startsWith('&#x')
      ? Number.parseInt(entity.slice(3, -1), 16)
      : Number.parseInt(entity.slice(2, -1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
  });
}

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1]] = decodeEntities(match[2] ?? match[3] ?? '');
  }
  return attributes;
}

export interface JunitCase {
  readonly id: string;
  readonly status: 'passed' | 'failed' | 'error' | 'skipped';
}

const TESTCASE_PATTERN = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase\s*>)/gu;

export function parseJunit(xml: string): readonly JunitCase[] {
  const cases: JunitCase[] = [];
  for (const match of xml.matchAll(TESTCASE_PATTERN)) {
    const attributes = readAttributes(match[1]);
    const body = match[3] ?? '';
    const name = attributes.name ?? '';
    const scope = attributes.classname ?? attributes.file ?? '';
    const id = scope ? `${scope} > ${name}` : name;
    let status: JunitCase['status'] = 'passed';
    if (/<failure\b/u.test(body)) status = 'failed';
    else if (/<error\b/u.test(body)) status = 'error';
    else if (/<skipped\b/u.test(body)) status = 'skipped';
    cases.push({ id: id || '(unnamed test)', status });
  }
  return cases;
}

/**
 * Makes test ids unique while keeping one id per discovered case, so the
 * contract invariant `discovered === discoveredIds.length` holds even when a
 * reporter emits the same classname+name twice (e.g. `test.each` rows).
 */
export function uniqueTestIds(ids: readonly string[]): string[] {
  const seen = new Map<string, number>();
  const unique: string[] = [];
  for (const id of ids) {
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    unique.push(count === 0 ? id : `${id} #${count + 1}`);
  }
  return unique;
}

export function buildTestInventory(
  files: ReadonlyArray<{ readonly path: string; readonly xml: string }>,
): TestInventoryDetail {
  const ids: string[] = [];
  let passed = 0;
  let failed = 0;
  let errors = 0;
  let skipped = 0;
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    for (const testCase of parseJunit(file.xml)) {
      ids.push(`${file.path} :: ${testCase.id}`);
      if (testCase.status === 'passed') passed += 1;
      else if (testCase.status === 'failed') failed += 1;
      else if (testCase.status === 'error') errors += 1;
      else skipped += 1;
    }
  }
  const unique = uniqueTestIds(ids);
  return {
    discovered: ids.length,
    passed,
    failed,
    errors,
    skipped,
    ids: unique.slice(0, MAX_TEST_IDS),
    idsTruncated: unique.length > MAX_TEST_IDS,
    junitFiles: files.map((file) => file.path).sort(),
  };
}
