#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  filterGitleaksFindings,
  parseGitleaksBaseline,
  parseGitleaksReport,
} from './gitleaks-baseline';

type SecretPattern = {
  name: string;
  regex: RegExp;
};

type CommandResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

type ExternalScannerResult = {
  failures: number;
  missing: string[];
};

export type SecretFinding = {
  file: string;
  line: number;
  rule: string;
  snippet: string;
};

const MAX_SCAN_BYTES = 1_000_000;
const EXCLUDED_PATH_PARTS = new Set([
  '.git',
  '.next',
  '.turbo',
  'node_modules',
  'test-results',
  'playwright-report',
]);
const BINARY_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.svgz',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'private-key',
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
  {
    name: 'aws-access-key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: 'github-token',
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
  },
  {
    name: 'openai-api-key',
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    name: 'resend-api-key',
    regex: /\bre_[A-Za-z0-9]{24,}\b/g,
  },
  {
    name: 'slack-token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    name: 'stripe-live-secret',
    regex: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g,
  },
  {
    name: 'supabase-service-role-jwt',
    regex:
      /\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"]?eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,
  },
];

const PLACEHOLDER_SECRET_VALUE_PATTERN =
  /\b(?:changeme|dummy|example|fake|fixture|mock|placeholder|redacted|sample|test|xxxx)\b/i;

function parseBooleanEnv(value: string | undefined): boolean {
  return /^(true|1|yes)$/i.test(value?.trim() ?? '');
}

export function allowsBuiltInOnlySecretScan(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBooleanEnv(env.SECRET_SCAN_ALLOW_BUILT_IN_ONLY);
}

function run(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: result.status,
    stderr: typeof result.stderr === 'string' ? result.stderr : String(result.stderr ?? ''),
    stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? ''),
  };
}

function commandExists(command: string): boolean {
  // Preserve the job PATH, including tools installed through GITHUB_PATH.
  return run('sh', ['-c', `command -v ${command} >/dev/null 2>&1`]).status === 0;
}

function gitTrackedAndUntrackedFiles(): string[] {
  const result = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Unable to enumerate repository files for secret scan.');
  }
  return result.stdout.split('\0').filter(Boolean);
}

function isExcludedPath(file: string): boolean {
  const parts = file.split(/[\\/]+/);
  if (parts.some((part) => EXCLUDED_PATH_PARTS.has(part))) return true;
  return BINARY_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isLikelyText(buffer: Buffer): boolean {
  return !buffer.includes(0);
}

function lineNumberForIndex(source: string, index: number): number {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (source.charCodeAt(offset) === 10) line += 1;
  }
  return line;
}

function lineForIndex(source: string, index: number): string {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? undefined : end);
}

export function redactSecretSnippet(value: string, rule: string): string {
  return value.replace(/[A-Za-z0-9_./+=:-]{10,}/g, `[redacted:${rule}]`).slice(0, 240);
}

export function scanSecretText(source: string, file: string): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of source.matchAll(pattern.regex)) {
      const index = match.index ?? 0;
      const line = lineForIndex(source, index);
      if (PLACEHOLDER_SECRET_VALUE_PATTERN.test(match[0])) continue;

      findings.push({
        file,
        line: lineNumberForIndex(source, index),
        rule: pattern.name,
        snippet: redactSecretSnippet(line.trim(), pattern.name),
      });
    }
  }

  return findings;
}

function scanFile(file: string): SecretFinding[] {
  if (isExcludedPath(file)) return [];

  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return [];
  }
  if (!stat.isFile() || stat.size > MAX_SCAN_BYTES) return [];

  const buffer = fs.readFileSync(file);
  if (!isLikelyText(buffer)) return [];

  return scanSecretText(buffer.toString('utf8'), file);
}

function runGitleaks(): boolean {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'nabatable-gitleaks-'));
  try {
    const reportPath = path.join(directory, 'report.json');
    fs.writeFileSync(reportPath, '', { mode: 0o600 });
    const result = run('gitleaks', [
      'detect',
      '--no-banner',
      '--redact=100',
      '--report-format=json',
      '--report-path',
      reportPath,
    ]);
    if (result.status !== 0 && result.status !== 1) throw new Error('Unexpected scanner exit');
    if (fs.statSync(reportPath).size > 20 * 1024 * 1024)
      throw new Error('Oversized scanner report');
    const findings = parseGitleaksReport(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
    if ((result.status === 0) !== (findings.length === 0))
      throw new Error('Inconsistent scanner result');
    const baseline = parseGitleaksBaseline(
      JSON.parse(fs.readFileSync('config/ci/gitleaks-baseline.json', 'utf8')),
    );
    const filtered = filterGitleaksFindings(findings, baseline);
    if (filtered.unmatched.length > 0) {
      console.error(
        `[secret:scan] gitleaks reported ${filtered.unmatched.length} unreviewed finding(s).`,
      );
      return false;
    }
    if (filtered.baselined > 0)
      console.log(
        `[secret:scan] gitleaks matched ${filtered.baselined} content-bound reviewed finding(s).`,
      );
    return true;
  } catch {
    // Never expose scanner output, report contents, or Git/provider errors.
    console.error('[secret:scan] gitleaks scan or baseline validation failed.');
    return false;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function runExternalScanners(): ExternalScannerResult {
  let failures = 0;
  const missing: string[] = [];

  if (commandExists('gitleaks')) {
    if (!runGitleaks()) failures += 1;
  } else {
    missing.push('gitleaks');
  }

  if (commandExists('trufflehog')) {
    const result = run('trufflehog', [
      'filesystem',
      '--no-update',
      '--only-verified',
      '--fail',
      '.',
    ]);
    if (result.status !== 0) console.error(`[secret:scan] trufflehog exited ${result.status}.`);
    if (result.status !== 0) failures += 1;
  } else {
    missing.push('trufflehog');
  }

  return { failures, missing };
}

export function runSecretScan(): number {
  const externalResult = runExternalScanners();
  const findings = gitTrackedAndUntrackedFiles().flatMap(scanFile);

  if (findings.length > 0) {
    console.error(`[secret:scan] ${findings.length} potential secret finding(s):`);
    for (const finding of findings) {
      console.error(`  - ${finding.file}:${finding.line} ${finding.rule} ${finding.snippet}`);
    }
    return 1;
  }

  if (externalResult.failures > 0) {
    console.error(
      `[secret:scan] ${externalResult.failures} external scanner(s) reported findings.`,
    );
    return 1;
  }

  if (externalResult.missing.length > 0 && !allowsBuiltInOnlySecretScan()) {
    console.error(
      `[secret:scan] missing required external scanner(s): ${externalResult.missing.join(', ')}.`,
    );
    console.error(
      '[secret:scan] install the missing scanner(s), or set SECRET_SCAN_ALLOW_BUILT_IN_ONLY=true for an explicit local fallback run.',
    );
    return 1;
  }

  if (externalResult.missing.length > 0) {
    console.warn(
      `[secret:scan] ${externalResult.missing.join(
        ', ',
      )} not found; SECRET_SCAN_ALLOW_BUILT_IN_ONLY=true accepted the built-in scanner fallback.`,
    );
  }

  console.log('[secret:scan] no potential secrets found.');
  return 0;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runSecretScan();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
