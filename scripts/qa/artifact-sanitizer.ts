#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactQaArtifact, redactQaText } from './redaction';

export type QaArtifactSanitizeStatus = 'redacted' | 'removed' | 'skipped' | 'unchanged';

export type QaArtifactSanitizeFileResult = {
  path: string;
  reason?: string;
  status: QaArtifactSanitizeStatus;
};

export type QaArtifactSanitizeSummary = {
  files: QaArtifactSanitizeFileResult[];
  redacted: number;
  removed: number;
  scanned: number;
  skipped: number;
  unchanged: number;
};

export type QaArtifactSanitizeOptions = {
  projectRoot?: string;
};

const TEXT_ARTIFACT_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.har',
  '.html',
  '.json',
  '.jsonl',
  '.log',
  '.md',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

function normalizePathname(pathname: string): string {
  return pathname.split(path.sep).join('/');
}

function assertInsideProject(targetPath: string, projectRoot: string): void {
  const relative = path.relative(projectRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `QA artifact sanitizer target must resolve inside the project root: ${targetPath}`,
    );
  }
}

function listFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const stat = fs.statSync(rootDir);
  if (stat.isFile()) return [rootDir];

  const files: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function sanitizeJsonText(raw: string): string {
  try {
    return `${JSON.stringify(redactQaArtifact(JSON.parse(raw)), null, 2)}\n`;
  } catch {
    return redactQaText(raw);
  }
}

function sanitizeJsonLines(raw: string): string {
  const lines = raw.split(/\r?\n/);
  return lines
    .map((line) => {
      if (!line.trim()) return line;
      try {
        return JSON.stringify(redactQaArtifact(JSON.parse(line)));
      } catch {
        return redactQaText(line);
      }
    })
    .join('\n');
}

function isTraceArchive(filePath: string): boolean {
  return path.basename(filePath).toLowerCase() === 'trace.zip';
}

export function sanitizeQaArtifactFile(
  filePath: string,
  options: QaArtifactSanitizeOptions = {},
): QaArtifactSanitizeFileResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const resolved = path.resolve(filePath);
  assertInsideProject(resolved, projectRoot);

  const relativePath = normalizePathname(path.relative(projectRoot, resolved));
  if (isTraceArchive(resolved)) {
    fs.unlinkSync(resolved);
    fs.writeFileSync(
      `${resolved}.redacted.txt`,
      'Playwright trace archive removed by QA artifact sanitizer. Trace archives can retain cookies, tokens, headers, emails, phones, and request payloads.\n',
      'utf8',
    );
    return {
      path: relativePath,
      reason: 'playwright trace archive removed',
      status: 'removed',
    };
  }

  const extension = path.extname(resolved).toLowerCase();
  if (!TEXT_ARTIFACT_EXTENSIONS.has(extension)) {
    return {
      path: relativePath,
      reason: `unsupported artifact extension ${extension || '[none]'}`,
      status: 'skipped',
    };
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const sanitized =
    extension === '.json' || extension === '.har'
      ? sanitizeJsonText(raw)
      : extension === '.jsonl'
        ? sanitizeJsonLines(raw)
        : redactQaText(raw);

  if (sanitized === raw) {
    return {
      path: relativePath,
      status: 'unchanged',
    };
  }

  fs.writeFileSync(resolved, sanitized, 'utf8');
  return {
    path: relativePath,
    status: 'redacted',
  };
}

function summarize(results: QaArtifactSanitizeFileResult[]): QaArtifactSanitizeSummary {
  return {
    files: results,
    redacted: results.filter((result) => result.status === 'redacted').length,
    removed: results.filter((result) => result.status === 'removed').length,
    scanned: results.length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    unchanged: results.filter((result) => result.status === 'unchanged').length,
  };
}

export function sanitizeQaArtifactTree(
  rootDir: string,
  options: QaArtifactSanitizeOptions = {},
): QaArtifactSanitizeSummary {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const resolvedRoot = path.resolve(rootDir);
  assertInsideProject(resolvedRoot, projectRoot);

  return summarize(
    listFiles(resolvedRoot).map((filePath) => sanitizeQaArtifactFile(filePath, { projectRoot })),
  );
}

export function runQaArtifactSanitizer(argv: readonly string[] = process.argv.slice(2)): number {
  const rootDir = argv[0] ?? 'test-results/qa';
  const summary = sanitizeQaArtifactTree(rootDir);
  console.log(
    `[qa:artifact-sanitizer] scanned ${summary.scanned}, redacted ${summary.redacted}, removed ${summary.removed}, skipped ${summary.skipped}, unchanged ${summary.unchanged}.`,
  );
  return 0;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runQaArtifactSanitizer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
