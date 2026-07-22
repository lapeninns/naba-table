#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { parse } from '@babel/parser';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const PRIMITIVES_ONLY = ARGS.includes('--primitives-only');
const BASELINE_ARG = ARGS.find((arg) => arg.startsWith('--baseline='));
const BASELINE_PATH = BASELINE_ARG?.slice('--baseline='.length);
const UPDATE_BASELINE = ARGS.includes('--update-baseline');
const MAX_EXAMPLES_PER_GROUP = 20;

const SCAN_ROOTS = [
  'src/app/app',
  'src/app/(public)',
  'src/app/guest',
  'src/components',
  'components',
  'reserve',
];

const ALLOWED_UI_ROOTS = ['components/ui'];

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

const BANNED_IMPORT_PATTERNS = [
  {
    label: '@radix-ui/*',
    pattern: /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@radix-ui\//g,
  },
  {
    label: '@headlessui/react',
    pattern: /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@headlessui\/react['"]/g,
  },
  {
    label: 'react-tooltip',
    pattern: /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])react-tooltip['"]/g,
  },
  {
    label: '@floating-ui/*',
    pattern: /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@floating-ui\//g,
  },
  {
    label: '@ariakit/*',
    pattern: /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@ariakit\//g,
  },
];

const BANNED_REACHABLE_IMPORT_PATTERNS = [
  {
    label: '@shared/ui/*',
    pattern: /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@shared\/ui(?:\/|['"])/g,
  },
  {
    label: '@features/*/ui barrel',
    pattern:
      /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@features\/[^'"]*\/ui(?:\/index)?['"]/g,
  },
  {
    label: '@reserve/*/ui barrel',
    pattern:
      /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@reserve\/[^'"]*\/ui(?:\/index)?['"]/g,
  },
  {
    label: '@/components/guest/ui/GuestPrimitives',
    pattern:
      /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])@\/components\/guest\/ui\/GuestPrimitives(?:['"]|\/)/g,
  },
];

const NATIVE_RENDERABLE_TAG_PATTERN =
  /<(?!(?:[A-Z][A-Za-z0-9.]*)\b)(button|select|textarea|input|table|dialog|label|form|datalist|option|iframe)\b/g;

const AD_HOC_COLOR_CLASS_PATTERN =
  /\b(?:[a-z0-9!_\-[\]=/]+:)*(?:bg|text|border(?:-[trblxy])?|ring|from|to|via|fill|stroke|outline|decoration|divide|placeholder|accent|caret)-(?:(?:slate|zinc|blue|red|green|purple|amber|emerald|rose|sky|indigo|gray|orange|stone)-\d{2,3}|white|black)(?:\/\d+)?\b/g;

const ALLOWED_ANCHOR_AS_CHILD_PARENTS = new Set([
  'Button',
  'SidebarMenuButton',
  'DropdownMenuItem',
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isAllowedUiPath(relativePath) {
  return ALLOWED_UI_ROOTS.some(
    (root) => relativePath === root || relativePath.startsWith(`${root}/`),
  );
}

function isExcludedPath(relativePath) {
  return (
    relativePath === 'tests' ||
    relativePath.startsWith('tests/') ||
    relativePath.startsWith('test-results/') ||
    relativePath.includes('/__stories__/') ||
    relativePath.includes('/__tests__/') ||
    /\.(?:test|spec)\.[jt]sx?$/.test(relativePath)
  );
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

function candidateSourceFiles(basePath) {
  const candidates = [];
  for (const extension of SOURCE_EXTENSIONS) {
    candidates.push(`${basePath}${extension}`);
  }
  for (const extension of SOURCE_EXTENSIONS) {
    candidates.push(path.join(basePath, `index${extension}`));
  }
  return candidates;
}

function resolveLocalImport(specifier, fromFile) {
  let basePaths = [];

  if (specifier.startsWith('@/')) {
    const target = specifier.slice(2);
    basePaths = [path.join(ROOT, target), path.join(ROOT, 'src', target)];
  } else if (specifier.startsWith('@src/')) {
    basePaths = [path.join(ROOT, 'src', specifier.slice(5))];
  } else if (specifier.startsWith('@features/')) {
    basePaths = [path.join(ROOT, 'reserve/features', specifier.slice(10))];
  } else if (specifier.startsWith('@reserve/')) {
    basePaths = [path.join(ROOT, 'reserve', specifier.slice(9))];
  } else if (specifier.startsWith('@shared/')) {
    basePaths = [path.join(ROOT, 'reserve/shared', specifier.slice(8))];
  } else if (specifier.startsWith('@entities/')) {
    basePaths = [path.join(ROOT, 'reserve/entities', specifier.slice(10))];
  } else if (specifier.startsWith('@app/')) {
    basePaths = [path.join(ROOT, 'reserve/app', specifier.slice(5))];
  } else if (specifier.startsWith('@pages/')) {
    basePaths = [path.join(ROOT, 'reserve/pages', specifier.slice(7))];
  } else if (specifier.startsWith('.')) {
    basePaths = [path.resolve(path.dirname(fromFile), specifier)];
  }

  if (basePaths.length === 0) {
    return null;
  }

  for (const basePath of basePaths) {
    for (const candidate of candidateSourceFiles(basePath)) {
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function collectLocalImports(source) {
  const imports = [];
  const importPattern =
    /(?:import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?|export\s+(?:type\s+)?[^'";]+?\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;

  for (const match of source.matchAll(importPattern)) {
    imports.push(match[1]);
  }

  return imports;
}

function collectReachableFiles(entries) {
  const stack = entries.flatMap((entry) => collectFiles(entry));
  const seen = new Set();

  while (stack.length > 0) {
    const file = stack.pop();
    if (!file) continue;

    const relativePath = toPosixPath(path.relative(ROOT, file));
    if (seen.has(relativePath)) continue;
    seen.add(relativePath);

    let source = '';
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const specifier of collectLocalImports(source)) {
      const resolved = resolveLocalImport(specifier, file);
      if (!resolved) continue;
      const resolvedRelativePath = toPosixPath(path.relative(ROOT, resolved));
      if (!seen.has(resolvedRelativePath)) {
        stack.push(resolved);
      }
    }
  }

  return [...seen].map((relativePath) => path.join(ROOT, relativePath));
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
      // Dev harnesses are supplemental, non-shipped surface (dev harness paths,
      // __dev/**). They may use iframes / neutral chrome and are not held to the
      // shipped-UI shadcn primitive rule — same rationale as __stories__.
      dirent.name === 'dev' ||
      dirent.name === '__dev' ||
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

function jsxElementName(node) {
  if (!node) return '';
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${jsxElementName(node.object)}.${jsxElementName(node.property)}`;
  }
  return '';
}

function hasAsChildAttribute(node) {
  return Boolean(
    node?.openingElement?.attributes?.some(
      (attribute) => attribute.type === 'JSXAttribute' && attribute.name?.name === 'asChild',
    ),
  );
}

function structuralFindingsTarget(findings) {
  return PRIMITIVES_ONLY ? findings.blocking : findings.advisory;
}

function scanStandaloneAnchors(node, stack, file, findings) {
  if (!node || typeof node !== 'object') return;

  let nextStack = stack;

  if (node.type === 'JSXElement') {
    const elementName = jsxElementName(node.openingElement.name);
    const parent = stack.at(-1);

    if (elementName === 'a') {
      const parentName = jsxElementName(parent?.openingElement?.name);
      const isAllowedAsChild =
        parent && ALLOWED_ANCHOR_AS_CHILD_PARENTS.has(parentName) && hasAsChildAttribute(parent);

      if (!isAllowedAsChild) {
        pushFinding(
          structuralFindingsTarget(findings),
          'standalone-anchor',
          file,
          node.loc?.start?.line ?? 1,
          'Native <a> must be composed through an approved shadcn asChild component.',
        );
      }
    }

    nextStack = stack.concat(node);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;

    if (Array.isArray(value)) {
      for (const child of value) scanStandaloneAnchors(child, nextStack, file, findings);
      continue;
    }

    scanStandaloneAnchors(value, nextStack, file, findings);
  }
}

function scanJsxStructure(source, relativePath, findings) {
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch (error) {
    pushFinding(
      findings.blocking,
      'parse-error',
      relativePath,
      1,
      `Unable to parse source for shadcn composition guard: ${error.message}`,
    );
    return;
  }

  scanStandaloneAnchors(ast, [], relativePath, findings);
}

function pushFinding(findings, kind, file, line, message) {
  findings.push({ kind, file, line, message });
}

function scanFile(file, findings) {
  const relativePath = toPosixPath(path.relative(ROOT, file));
  if (isAllowedUiPath(relativePath)) return;
  if (isExcludedPath(relativePath)) return;

  const source = fs.readFileSync(file, 'utf8');

  for (const { label, pattern } of BANNED_IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      pushFinding(
        findings.blocking,
        'banned-import',
        relativePath,
        lineNumberForIndex(source, match.index ?? 0),
        `Import ${label} through @/components/ui/* or an approved shadcn-composed app component.`,
      );
    }
  }

  for (const { label, pattern } of BANNED_REACHABLE_IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      pushFinding(
        findings.blocking,
        'banned-reachable-import',
        relativePath,
        lineNumberForIndex(source, match.index ?? 0),
        `App UI must not import ${label}; compose @/components/ui/* or an approved feature component instead.`,
      );
    }
  }

  NATIVE_RENDERABLE_TAG_PATTERN.lastIndex = 0;
  for (const match of source.matchAll(NATIVE_RENDERABLE_TAG_PATTERN)) {
    pushFinding(
      structuralFindingsTarget(findings),
      'native-renderable',
      relativePath,
      lineNumberForIndex(source, match.index ?? 0),
      `Native <${match[1]}> remains in app UI scope; prefer a shadcn primitive or approved composed component.`,
    );
  }

  AD_HOC_COLOR_CLASS_PATTERN.lastIndex = 0;
  for (const match of source.matchAll(AD_HOC_COLOR_CLASS_PATTERN)) {
    pushFinding(
      findings.advisory,
      'ad-hoc-token',
      relativePath,
      lineNumberForIndex(source, match.index ?? 0),
      'Ad-hoc color utility found in Ops UI source; prefer shadcn/Tailwind semantic tokens.',
    );
  }

  scanJsxStructure(source, relativePath, findings);
}

function groupFindings(findings) {
  return findings.reduce((groups, finding) => {
    const key = finding.kind;
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
    return groups;
  }, new Map());
}

function printFindings(title, findings) {
  if (findings.length === 0) return;

  console.log(`\n${title}`);
  for (const [kind, group] of groupFindings(findings)) {
    console.log(`\n${kind}: ${group.length}`);
    for (const finding of group.slice(0, MAX_EXAMPLES_PER_GROUP)) {
      console.log(`  ${finding.file}:${finding.line} - ${finding.message}`);
    }
    if (group.length > MAX_EXAMPLES_PER_GROUP) {
      console.log(`  ... ${group.length - MAX_EXAMPLES_PER_GROUP} more`);
    }
  }
}

function countByKind(items) {
  return Object.fromEntries(
    [...groupFindings(items)].map(([kind, group]) => [kind, group.length]).sort(),
  );
}

function writeBaseline(filePath, findings) {
  if (!filePath) return;

  const absolutePath = path.resolve(ROOT, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(
    absolutePath,
    `${JSON.stringify(
      {
        blocking: countByKind(findings.blocking),
        advisory: countByKind(findings.advisory),
      },
      null,
      2,
    )}\n`,
  );
}

function loadBaseline(filePath) {
  const absolutePath = path.resolve(ROOT, filePath);
  if (!fs.existsSync(absolutePath)) return null;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

/**
 * Ratchet a bucket of findings against a baseline count map. Returns the list
 * of kinds that regressed above baseline and the list that improved below it,
 * so the gate blocks new debt while tolerating (and inviting cleanup of) known
 * debt — the same contract as guard:luma.
 */
function diffAgainstBaseline(current, baseline) {
  const base = baseline ?? {};
  const regressions = [];
  const improvements = [];
  for (const [kind, count] of Object.entries(current)) {
    const allowed = base[kind] ?? 0;
    if (count > allowed) regressions.push(`${kind}: ${count} (baseline ${allowed})`);
  }
  for (const [kind, allowed] of Object.entries(base)) {
    const count = current[kind] ?? 0;
    if (count < allowed) improvements.push(`${kind}: ${count} (baseline ${allowed})`);
  }
  return { regressions, improvements };
}

const files = [...new Set(SCAN_ROOTS.flatMap((entry) => collectFiles(entry)))].sort();
const findings = {
  blocking: [],
  advisory: [],
};

for (const file of files) {
  scanFile(file, findings);
}

if (BASELINE_PATH && UPDATE_BASELINE) {
  writeBaseline(BASELINE_PATH, findings);
  console.log(`Wrote shadcn primitive baseline to ${BASELINE_PATH}.`);
  process.exit(0);
}

console.log(`Scanned ${files.length} shadcn-governed UI source files.`);
printFindings('Blocking findings', findings.blocking);
printFindings('Advisory migration inventory', findings.advisory);

const strictFindings = findings.advisory.filter((finding) => finding.kind !== 'ad-hoc-token');

// Baseline (ratchet) mode: block only NEW debt above the pinned counts, tolerate
// known debt, and nudge to tighten the baseline when it drops. Same contract as
// guard:luma. Without a baseline, fall back to the original hard gate below.
if (BASELINE_PATH) {
  const baseline = loadBaseline(BASELINE_PATH);
  if (!baseline) {
    console.error(
      `\nBaseline ${BASELINE_PATH} not found. Create it with --update-baseline before ratcheting.`,
    );
    process.exit(1);
  }

  const { regressions, improvements } = diffAgainstBaseline(
    countByKind(findings.blocking),
    baseline.blocking,
  );

  if (regressions.length > 0) {
    console.error(
      `\nFailed baseline ratchet: ${regressions.length} finding kind(s) above baseline:\n  ${regressions.join('\n  ')}\n` +
        `Fix the new finding(s), or intentionally re-pin with --update-baseline.`,
    );
    process.exit(1);
  }

  if (improvements.length > 0) {
    console.log(
      `\nBelow baseline — tighten it with --update-baseline:\n  ${improvements.join('\n  ')}`,
    );
  }
  console.log('\nPassed baseline ratchet: no shadcn primitive findings above baseline.');
  process.exit(0);
}

if (findings.blocking.length > 0) {
  console.error(
    `\nFailed: ${findings.blocking.length} blocking shadcn primitive finding(s) found in app UI scope.`,
  );
  process.exit(1);
}

if (STRICT && strictFindings.length > 0) {
  console.error(
    `\nFailed strict mode: ${strictFindings.length} remaining non-color shadcn migration finding(s).`,
  );
  process.exit(1);
}

if (findings.advisory.length > 0) {
  console.log(
    `\nPassed blocking checks with ${findings.advisory.length} advisory migration finding(s). Color-token findings are advisory-only.`,
  );
} else {
  console.log('\nPassed: no blocking or advisory shadcn migration findings.');
}
