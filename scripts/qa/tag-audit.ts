#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QA_TEST_TAGS } from './tags';

export type QaTagAuditTestTitle = {
  file: string;
  line: number;
  tags: string[];
  title: string;
};

export type QaTagAuditFileSummary = {
  file: string;
  tagged: number;
  testTitles: number;
  untagged: number;
};

export type QaTagAuditUnknownTag = {
  file: string;
  line: number;
  tag: string;
  title: string;
};

export type QaTagAuditSnapshot = {
  files: QaTagAuditFileSummary[];
  schemaVersion: 1;
  scanRoots: string[];
  totals: {
    files: number;
    tagged: number;
    testTitles: number;
    unknownTags: number;
    untagged: number;
  };
  unknownTags: QaTagAuditUnknownTag[];
};

export type QaTagAuditComparison = {
  failures: string[];
  passed: boolean;
};

type CliOptions = {
  baselinePath: string | null;
  roots: string[];
  updateBaseline: boolean;
};

const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx)$/;
const TEST_TITLE_PATTERN =
  /\b(?:test|it)(?:\.(?:concurrent|fails|fixme|only|skip|todo))?\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
const TAG_PATTERN = /@[A-Za-z0-9_-]+/g;
const KNOWN_TAGS = new Set<string>(QA_TEST_TAGS);

function normalizePathname(pathname: string): string {
  return pathname.split(path.sep).join('/');
}

function lineNumberForOffset(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function listTestFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return TEST_FILE_PATTERN.test(root) ? [root] : [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTestFiles(entryPath));
    } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

export function extractQaTestTitles(source: string, file: string): QaTagAuditTestTitle[] {
  const titles: QaTagAuditTestTitle[] = [];
  let match: RegExpExecArray | null;

  while ((match = TEST_TITLE_PATTERN.exec(source))) {
    const title = match[2] ?? '';
    const tags = Array.from(title.matchAll(TAG_PATTERN), (tagMatch) => tagMatch[0]);
    titles.push({
      file,
      line: lineNumberForOffset(source, match.index),
      tags,
      title,
    });
  }

  return titles;
}

export function buildQaTagAuditSnapshot(
  entries: readonly QaTagAuditTestTitle[],
  scanRoots: readonly string[],
): QaTagAuditSnapshot {
  const files = new Map<string, QaTagAuditFileSummary>();
  const unknownTags: QaTagAuditUnknownTag[] = [];
  let tagged = 0;
  let untagged = 0;

  for (const entry of entries) {
    const summary = files.get(entry.file) ?? {
      file: entry.file,
      tagged: 0,
      testTitles: 0,
      untagged: 0,
    };
    summary.testTitles += 1;

    if (entry.tags.length > 0) {
      tagged += 1;
      summary.tagged += 1;
    } else {
      untagged += 1;
      summary.untagged += 1;
    }

    for (const tag of entry.tags) {
      if (!KNOWN_TAGS.has(tag)) {
        unknownTags.push({
          file: entry.file,
          line: entry.line,
          tag,
          title: entry.title,
        });
      }
    }

    files.set(entry.file, summary);
  }

  const fileSummaries = Array.from(files.values()).sort((left, right) =>
    left.file.localeCompare(right.file),
  );

  return {
    files: fileSummaries,
    schemaVersion: 1,
    scanRoots: Array.from(scanRoots).map(normalizePathname).sort(),
    totals: {
      files: fileSummaries.length,
      tagged,
      testTitles: entries.length,
      unknownTags: unknownTags.length,
      untagged,
    },
    unknownTags: unknownTags.sort(
      (left, right) => left.file.localeCompare(right.file) || left.line - right.line,
    ),
  };
}

export function auditQaTestTags(roots: readonly string[] = ['tests']): QaTagAuditSnapshot {
  const files = Array.from(new Set(roots.flatMap(listTestFiles)))
    .map((file) => path.relative(process.cwd(), file))
    .map(normalizePathname)
    .sort();
  const entries = files.flatMap((file) => extractQaTestTitles(fs.readFileSync(file, 'utf8'), file));

  return buildQaTagAuditSnapshot(entries, roots);
}

function fileSummaryMap(snapshot: QaTagAuditSnapshot): Map<string, QaTagAuditFileSummary> {
  return new Map(snapshot.files.map((file) => [file.file, file]));
}

export function compareQaTagAuditToBaseline(
  current: QaTagAuditSnapshot,
  baseline: QaTagAuditSnapshot,
): QaTagAuditComparison {
  const failures: string[] = [];
  const baselineFiles = fileSummaryMap(baseline);

  if (current.unknownTags.length > 0) {
    for (const unknown of current.unknownTags) {
      failures.push(`${unknown.file}:${unknown.line} uses unknown QA tag ${unknown.tag}.`);
    }
  }

  if (current.totals.untagged > baseline.totals.untagged) {
    failures.push(
      `Untagged QA test titles increased from ${baseline.totals.untagged} to ${current.totals.untagged}.`,
    );
  }

  for (const file of current.files) {
    const baselineFile = baselineFiles.get(file.file);
    const baselineUntagged = baselineFile?.untagged ?? 0;
    if (file.untagged > baselineUntagged) {
      failures.push(
        `${file.file} has ${file.untagged} untagged QA test title(s), above baseline ${baselineUntagged}.`,
      );
    }
  }

  return {
    failures,
    passed: failures.length === 0,
  };
}

function parseArgs(argv: readonly string[]): CliOptions {
  const roots: string[] = [];
  let baselinePath: string | null = null;
  let updateBaseline = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--update-baseline') {
      updateBaseline = true;
      continue;
    }
    if (arg === '--baseline') {
      baselinePath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--baseline=')) {
      baselinePath = arg.slice('--baseline='.length);
      continue;
    }
    if (arg === '--root') {
      const root = argv[index + 1];
      if (root) roots.push(root);
      index += 1;
      continue;
    }
    if (arg.startsWith('--root=')) {
      roots.push(arg.slice('--root='.length));
      continue;
    }
    throw new Error(`Unknown QA tag audit option "${arg}".`);
  }

  return {
    baselinePath,
    roots: roots.length > 0 ? roots : ['tests'],
    updateBaseline,
  };
}

function readBaseline(baselinePath: string): QaTagAuditSnapshot {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as QaTagAuditSnapshot;
}

function writeBaseline(baselinePath: string, snapshot: QaTagAuditSnapshot): void {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

export function runQaTagAudit(argv: readonly string[] = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  const snapshot = auditQaTestTags(options.roots);

  console.log(
    `[qa:tag-audit] scanned ${snapshot.totals.files} file(s), ${snapshot.totals.testTitles} test title(s), ${snapshot.totals.tagged} tagged, ${snapshot.totals.untagged} untagged.`,
  );

  if (options.updateBaseline) {
    if (!options.baselinePath) {
      throw new Error('QA tag audit baseline update requires --baseline <path>.');
    }
    writeBaseline(options.baselinePath, snapshot);
    console.log(`[qa:tag-audit] updated baseline: ${options.baselinePath}`);
    return 0;
  }

  if (!options.baselinePath) {
    const passed = snapshot.unknownTags.length === 0;
    for (const unknown of snapshot.unknownTags) {
      console.error(`${unknown.file}:${unknown.line} uses unknown QA tag ${unknown.tag}.`);
    }
    return passed ? 0 : 1;
  }

  const comparison = compareQaTagAuditToBaseline(snapshot, readBaseline(options.baselinePath));
  if (comparison.passed) {
    console.log(`[qa:tag-audit] passed baseline ratchet: ${options.baselinePath}`);
    return 0;
  }

  for (const failure of comparison.failures) {
    console.error(`[qa:tag-audit] ${failure}`);
  }
  return 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runQaTagAudit();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
