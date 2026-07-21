#!/usr/bin/env node

/**
 * Typography-scale ratchet.
 *
 * Headings should render through the Luma `<Heading>` primitive
 * (components/ui/typography.tsx), not raw Tailwind heading-scale utilities.
 * This guard counts raw `text-2xl`..`text-5xl` occurrences (the unambiguous
 * heading sizes; `text-lg`/`text-xl` are left out because they legitimately
 * appear as lead/large-body) in app source OUTSIDE components/ui, and fails if
 * the count rises above the pinned baseline. Known bespoke sites (marketing
 * heroes, stat numerals) sit in the baseline; new raw headings are blocked.
 *
 * Same contract as guard:luma / guard:no-shadcn:ci — ratchet, don't hard-zero.
 *   node scripts/check-typography-scale.mjs                     # check
 *   node scripts/check-typography-scale.mjs --update-baseline   # re-pin
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const UPDATE = ARGS.includes('--update-baseline');
const BASELINE_PATH = path.join('config', 'qa', 'typography-scale-baseline.json');

const SCAN_ROOTS = ['src', 'components', 'reserve'];
const EXCLUDE_DIRS = new Set(['node_modules', '.next', 'dist', '.design-sync', 'worktrees']);
const HEADING_SCALE = /\b(?:[a-z]+:)*text-(?:2xl|3xl|4xl|5xl|6xl|7xl)\b/g;

function isExcluded(rel) {
  const parts = rel.split(path.sep);
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  if (rel.startsWith(path.join('components', 'ui') + path.sep)) return true;
  if (/\.(test|spec|stories)\.[jt]sx?$/.test(rel)) return true;
  return false;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.name.endsWith('.tsx') && !isExcluded(rel)) {
      out.push(rel);
    }
  }
}

const files = [];
for (const r of SCAN_ROOTS) walk(path.join(ROOT, r), files);

const hits = [];
for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const matches = src.match(HEADING_SCALE);
  if (matches) hits.push({ file, count: matches.length });
}
const total = hits.reduce((n, h) => n + h.count, 0);

if (UPDATE) {
  fs.mkdirSync(path.dirname(path.join(ROOT, BASELINE_PATH)), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, BASELINE_PATH),
    `${JSON.stringify({ total, files: hits.length, note: 'Raw text-2xl..7xl outside components/ui. Prefer <Heading>. Re-pin only when clearing debt.' }, null, 2)}\n`,
  );
  console.log(`Pinned typography-scale baseline: ${total} raw heading utilities across ${hits.length} files.`);
  process.exit(0);
}

const baseline = fs.existsSync(path.join(ROOT, BASELINE_PATH))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8'))
  : null;
if (!baseline) {
  console.error(`No baseline at ${BASELINE_PATH}. Create it with --update-baseline.`);
  process.exit(1);
}

console.log(`Raw heading-scale utilities (text-2xl..7xl) outside components/ui: ${total} (baseline ${baseline.total}).`);

if (total > baseline.total) {
  const worst = hits.sort((a, b) => b.count - a.count).slice(0, 10);
  console.error(
    `\n✗ ${total - baseline.total} new raw heading utility(ies) above baseline. Use <Heading> from ` +
      `@/components/ui/typography instead of raw text-2xl/3xl/... on headings.\n  Top files:\n` +
      worst.map((h) => `    ${h.file}: ${h.count}`).join('\n') +
      `\n  If this debt is intentional, re-pin with: pnpm guard:typography-scale:update-baseline`,
  );
  process.exit(1);
}

if (total < baseline.total) {
  console.log(`Below baseline — tighten it with --update-baseline (${baseline.total} → ${total}).`);
}
console.log('✓ No new raw heading-scale utilities above baseline.');
