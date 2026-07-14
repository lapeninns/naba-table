#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const REPORT_JSON_ARG = ARGS.filter((arg) => arg.startsWith('--report-json=')).at(-1);
const REPORT_JSON_PATH = REPORT_JSON_ARG?.slice('--report-json='.length);
const BASELINE_ARG = ARGS.filter((arg) => arg.startsWith('--baseline=')).at(-1);
const BASELINE_PATH = BASELINE_ARG?.slice('--baseline='.length);
const UPDATE_BASELINE = ARGS.includes('--update-baseline');
const FAIL_ON_ARG = ARGS.filter((arg) => arg.startsWith('--fail-on=')).at(-1);
const FAIL_ON = FAIL_ON_ARG?.slice('--fail-on='.length) ?? 'none';
const MAX_EXAMPLES_PER_GROUP = 20;
const BASELINE_VERSION = 1;

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);

const SCAN_ROOTS = [
  'src/app/app',
  'src/app/(public)',
  'src/app/guest',
  'src/app/auth',
  'src/app/error.tsx',
  'src/app/loading.tsx',
  'src/app/not-found.tsx',
  'components',
  'src/components',
  'reserve',
  'src/app/globals.css',
  'styles',
];

const APPROVED_RECIPE_PATHS = new Set([
  'styles/design-system/public-guest.tokens.css',
  'styles/design-system/public-guest.utilities.css',
]);

const EXCLUDED_PATH_PARTS = [
  '/node_modules/',
  '/.next/',
  '/test-results/',
  '/__tests__/',
  '/__stories__/',
  '/__dev__/',
  '/__dev/',
  '/dev/',
];

const EXCLUDED_PREFIXES = ['tests/', 'public/', 'storybook-static/', 'reserve/storybook-static/'];

const EXCLUDED_FILE_PATTERNS = [/\.(?:test|spec)\.[jt]sx?$/, /\.d\.ts$/, /\.min\.css$/, /backup/i];

const FINDING_RULES = [
  {
    kind: 'hardcoded-palette-utility',
    severity: 'exception',
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx']),
    pattern:
      /\b(?:[a-z0-9!_\-[\]=/]+:)*(?:bg|text|border(?:-[trblxy])?|ring|from|to|via|fill|stroke|outline|decoration|divide|placeholder|accent|caret)-(?:(?:slate|gray|zinc|neutral|stone|blue|indigo|violet|purple|emerald|green|red|orange|amber|yellow|cyan|sky|teal|rose|pink)-\d{2,3}|white|black)(?:\/\d+)?\b/g,
    message:
      'Hardcoded palette Tailwind utility found; use Radix Luma semantic tokens or an approved recipe class.',
  },
  {
    kind: 'arbitrary-color-utility',
    severity: 'exception',
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx']),
    pattern:
      /\b(?:[a-z0-9!_\-[\]=/]+:)*(?:bg|text|border(?:-[trblxy])?|ring|from|to|via|fill|stroke|outline|decoration|divide|placeholder|accent|caret|shadow)-\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|oklch|hsl|hsla|color-mix)\([^\]]+)\]/g,
    message:
      'Arbitrary raw color utility found; move this to a Luma token or named recipe before use.',
  },
  {
    kind: 'custom-gradient-utility',
    severity: 'exception',
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx']),
    pattern: /\b(?:[a-z0-9!_\-[\]=/]+:)*bg-gradient-to-[a-z]+\b/g,
    message:
      'Custom gradient utility found; gradients must be documented as named Radix Luma recipes.',
  },
  {
    kind: 'raw-color-literal',
    severity: 'exception',
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx']),
    pattern: /(?:#[0-9a-fA-F]{3,8}\b|(?:rgba?|oklch|hsla?)\([^)]+\))/g,
    message: 'Raw color literal found in UI source; use a semantic token or approved recipe.',
  },
  {
    kind: 'guest-theme-compatibility-reference',
    severity: 'review',
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx', '.css']),
    pattern: /\bguest-theme\b/g,
    message:
      'guest-theme compatibility class found; verify it is still needed after global Luma token promotion.',
  },
  {
    kind: 'legacy-theme-token',
    severity: 'review',
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx', '.css']),
    pattern:
      /(?:styles\/themes\/(?:app|guest)|themes\/(?:app|guest)\.css|--app-text|--guest-|--color-primary-|--color-accent-)/g,
    message:
      'Legacy app/guest theme token or compatibility alias found; verify it is still needed after Luma token promotion.',
  },
  {
    kind: 'css-raw-color-literal',
    severity: 'review',
    extensions: new Set(['.css']),
    pattern: /(?:#[0-9a-fA-F]{3,8}\b|(?:rgba?|oklch)\([^)]+\))/g,
    message:
      'Raw CSS color literal found outside the approved Luma recipe files; review for tokenization.',
  },
  {
    kind: 'css-gradient-recipe',
    severity: 'review',
    extensions: new Set(['.css']),
    pattern: /(?:linear-gradient|radial-gradient|conic-gradient)\(/g,
    message:
      'CSS gradient found outside the approved Luma recipe files; document as a named recipe or remove.',
  },
];

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function directoryExists(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function isExcludedPath(relativePath) {
  if (EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return true;
  if (EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath))) return true;

  const wrapped = `/${relativePath}`;
  return EXCLUDED_PATH_PARTS.some((part) => wrapped.includes(part));
}

function collectFiles(entry, files = []) {
  const absoluteEntry = path.join(ROOT, entry);
  const relativeEntry = toPosixPath(entry);

  if (fileExists(absoluteEntry)) {
    if (SOURCE_EXTENSIONS.has(path.extname(absoluteEntry)) && !isExcludedPath(relativeEntry)) {
      files.push(absoluteEntry);
    }
    return files;
  }

  if (!directoryExists(absoluteEntry)) return files;

  for (const dirent of fs.readdirSync(absoluteEntry, { withFileTypes: true })) {
    if (
      dirent.name === 'node_modules' ||
      dirent.name === '.next' ||
      dirent.name === 'tests' ||
      dirent.name === '__tests__' ||
      dirent.name === '__stories__' ||
      dirent.name === 'test-results'
    ) {
      continue;
    }

    const child = path.join(entry, dirent.name);
    const relativeChild = toPosixPath(child);
    if (isExcludedPath(relativeChild)) continue;

    if (dirent.isDirectory()) {
      collectFiles(child, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(dirent.name))) {
      files.push(path.join(ROOT, child));
    }
  }

  return files;
}

function lineNumberForIndex(source, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (source.charCodeAt(offset) === 10) line += 1;
  }
  return line;
}

function lineTextForIndex(source, index) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? source.length : end).trim();
}

function pushFinding(findings, finding) {
  findings.push(finding);
}

function scanFile(file, findings) {
  const relativePath = toPosixPath(path.relative(ROOT, file));
  const extension = path.extname(relativePath);
  const isApprovedRecipe = APPROVED_RECIPE_PATHS.has(relativePath);
  const source = fs.readFileSync(file, 'utf8');

  for (const rule of FINDING_RULES) {
    if (!rule.extensions.has(extension)) continue;
    if (
      isApprovedRecipe &&
      (rule.kind.startsWith('css-') ||
        rule.kind === 'legacy-theme-token' ||
        rule.kind === 'guest-theme-compatibility-reference')
    ) {
      continue;
    }

    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const matchedText = match[0];
      if (/^hsla?\(\s*var\(--/.test(matchedText)) continue;

      pushFinding(findings, {
        kind: rule.kind,
        severity: rule.severity,
        file: relativePath,
        line: lineNumberForIndex(source, match.index ?? 0),
        match: matchedText,
        message: rule.message,
        context: lineTextForIndex(source, match.index ?? 0),
      });
    }
  }
}

function groupFindings(findings, keyFn) {
  return findings.reduce((groups, finding) => {
    const key = keyFn(finding);
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
    return groups;
  }, new Map());
}

function countBy(findings, keyFn) {
  return Object.fromEntries(
    [...groupFindings(findings, keyFn).entries()]
      .map(([key, group]) => [key, group.length])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function printFindings(title, findings) {
  if (findings.length === 0) return;

  console.log(`\n${title}`);
  for (const [kind, group] of groupFindings(findings, (finding) => finding.kind)) {
    console.log(`\n${kind}: ${group.length}`);
    for (const finding of group.slice(0, MAX_EXAMPLES_PER_GROUP)) {
      console.log(`  ${finding.file}:${finding.line} - ${finding.match}`);
    }
    if (group.length > MAX_EXAMPLES_PER_GROUP) {
      console.log(`  ... ${group.length - MAX_EXAMPLES_PER_GROUP} more`);
    }
  }
}

function writeJsonReport(filePath, report) {
  if (!filePath) return;

  const absolutePath = path.resolve(ROOT, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(`${absolutePath}`, `${JSON.stringify(report, null, 2)}\n`);
}

function baselineKey(finding) {
  return `${finding.severity}::${finding.kind}::${finding.file}`;
}

function buildBaseline(report) {
  return {
    version: BASELINE_VERSION,
    generatedAt: report.generatedAt,
    description:
      'Pinned Radix Luma semantic-token migration debt. Update only after reviewing intentional debt movement.',
    scanRoots: report.scanRoots,
    approvedRecipePaths: report.approvedRecipePaths,
    counts: {
      total: report.counts.total,
      bySeverity: report.counts.bySeverity,
      byKind: report.counts.byKind,
      byFileKind: countBy(report.findings, baselineKey),
    },
  };
}

function writeBaseline(filePath, report) {
  if (!filePath) {
    console.error('Missing --baseline path for --update-baseline.');
    process.exit(2);
  }

  writeJsonReport(filePath, buildBaseline(report));
  console.log(`\nUpdated Luma baseline at ${filePath}.`);
}

function readBaseline(filePath) {
  if (!filePath) return null;

  const absolutePath = path.resolve(ROOT, filePath);
  if (!fileExists(absolutePath)) {
    console.error(`Missing Luma baseline file: ${filePath}`);
    process.exit(2);
  }

  const baseline = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (baseline.version !== BASELINE_VERSION || !baseline.counts?.byFileKind) {
    console.error(`Unsupported Luma baseline format: ${filePath}`);
    process.exit(2);
  }
  return baseline;
}

function scopedFindings(findings) {
  if (FAIL_ON === 'none') return findings;
  if (FAIL_ON === 'review') return findings;
  if (FAIL_ON === 'exception')
    return findings.filter((finding) => finding.severity === 'exception');

  console.error(`Unknown --fail-on value "${FAIL_ON}". Use none, exception, or review.`);
  process.exit(2);
}

function compareWithBaseline(findings, baseline) {
  if (!baseline) return null;

  const currentCounts = countBy(scopedFindings(findings), baselineKey);
  const baselineCounts = baseline.counts.byFileKind;
  const regressions = Object.entries(currentCounts)
    .map(([key, current]) => {
      const allowed = baselineCounts[key] ?? 0;
      return { allowed, current, key };
    })
    .filter((item) => item.current > item.allowed)
    .sort((left, right) => left.key.localeCompare(right.key));

  return { baseline, regressions };
}

function printBaselineComparison(comparison) {
  if (!comparison) return;

  if (comparison.regressions.length === 0) {
    console.log(
      `\nPassed Luma baseline ratchet for --fail-on=${FAIL_ON}: no above-baseline finding counts.`,
    );
    return;
  }

  console.error(`\nLuma baseline ratchet exceeded (${comparison.regressions.length} group(s)).`);
  for (const { allowed, current, key } of comparison.regressions.slice(0, MAX_EXAMPLES_PER_GROUP)) {
    const [severity, kind, file] = key.split('::');
    console.error(`  ${file} [${severity}/${kind}]: ${current} found, ${allowed} allowed`);
  }
  if (comparison.regressions.length > MAX_EXAMPLES_PER_GROUP) {
    console.error(`  ... ${comparison.regressions.length - MAX_EXAMPLES_PER_GROUP} more`);
  }
}

function shouldFail(findings, baselineComparison) {
  if (FAIL_ON === 'none') return false;
  if (baselineComparison) return baselineComparison.regressions.length > 0;
  if (FAIL_ON === 'review') return findings.length > 0;
  if (FAIL_ON === 'exception') {
    return findings.some((finding) => finding.severity === 'exception');
  }
  console.error(`Unknown --fail-on value "${FAIL_ON}". Use none, exception, or review.`);
  process.exit(2);
}

const files = [...new Set(SCAN_ROOTS.flatMap((entry) => collectFiles(entry)))].sort();
const findings = [];

for (const file of files) {
  scanFile(file, findings);
}

const report = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  scanRoots: SCAN_ROOTS,
  approvedRecipePaths: [...APPROVED_RECIPE_PATHS],
  counts: {
    total: findings.length,
    bySeverity: countBy(findings, (finding) => finding.severity),
    byKind: countBy(findings, (finding) => finding.kind),
    byFile: countBy(findings, (finding) => finding.file),
  },
  findings,
};

writeJsonReport(REPORT_JSON_PATH, report);
if (UPDATE_BASELINE) {
  writeBaseline(BASELINE_PATH, report);
}

console.log(`Scanned ${files.length} Radix Luma governed UI/style files.`);
printFindings(
  'Exception inventory',
  findings.filter((finding) => finding.severity === 'exception'),
);
printFindings(
  'Review inventory',
  findings.filter((finding) => finding.severity === 'review'),
);

if (REPORT_JSON_PATH) {
  console.log(`\nWrote JSON report to ${REPORT_JSON_PATH}.`);
}

const baselineComparison = compareWithBaseline(findings, readBaseline(BASELINE_PATH));
printBaselineComparison(baselineComparison);

if (findings.length === 0) {
  console.log('\nPassed: no Luma compliance findings.');
} else {
  console.log(
    `\nFound ${findings.length} Luma compliance finding(s). Default mode is inventory-only; use --fail-on=exception or --fail-on=review for blocking checks.`,
  );
}

if (shouldFail(findings, baselineComparison)) {
  console.error(`\nFailed --fail-on=${FAIL_ON}: Luma baseline ratchet exceeded.`);
  process.exit(1);
}
