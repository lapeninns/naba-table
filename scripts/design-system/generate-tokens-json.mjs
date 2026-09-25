#!/usr/bin/env node

/**
 * Regenerate docs/tokens.json from the token stylesheet.
 *
 * The stylesheet (styles/design-system/public-guest.tokens.css) is the single
 * source of truth; this export exists so tooling and reviewers can read the
 * token set without parsing CSS. Run after any token change:
 *
 *   pnpm design:tokens-json
 *
 * The contract test (tests/styles/design-tokens-contract.test.ts) fails when
 * the committed JSON drifts from the stylesheet.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TOKENS_CSS = path.join(ROOT, 'styles', 'design-system', 'public-guest.tokens.css');
const GLOBALS_CSS = path.join(ROOT, 'src', 'app', 'globals.css');
const OUT = path.join(ROOT, 'docs', 'tokens.json');

const DECLARATION = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;

/** Return the body of the first `{ … }` block whose selector list contains `marker`. */
function blockContaining(css, marker) {
  const at = css.indexOf(marker);
  if (at === -1) throw new Error(`selector marker not found: ${marker}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block for ${marker}`);
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function declarations(block) {
  const out = new Map();
  for (const match of stripComments(block).matchAll(DECLARATION)) {
    out.set(match[1], match[2].replace(/\s+/g, ' ').trim());
  }
  return out;
}

const tokensCss = fs.readFileSync(TOKENS_CSS, 'utf8');
const globalsCss = fs.readFileSync(GLOBALS_CSS, 'utf8');

const light = declarations(blockContaining(tokensCss, ":root,\n  [data-theme='guest']"));
const dark = declarations(blockContaining(tokensCss, '.dark,\n  :root.dark'));
const app = declarations(blockContaining(tokensCss, "[data-theme='app'] {"));
const theme = declarations(blockContaining(globalsCss, '@theme inline'));

const GROUPS = [
  [
    'color.shadcn',
    /^--(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|destructive|destructive-foreground|success|success-foreground|warning|warning-foreground|info|info-foreground|border|input|ring|overlay|chart-[1-5])$/,
  ],
  ['color.sidebar', /^--sidebar/],
  ['color.palette', /^--pg-(ink|paper|card|line|cobalt|danger|secondary-hover|neutral-glow)/],
  [
    'color.semantic',
    /^--pg-(bg|bg-muted|surface|surface-raised|border|text|text-muted|text-subtle|action|action-hover|action-contrast|accent|accent-hover|accent-soft)$/,
  ],
  ['color.status-scale', /^--color-(success|warning|error)-/],
  ['color.neutral-scale', /^--color-neutral-/],
  ['color.legacy', /^--color-(primary|text-primary|text-secondary|surface)$/],
  ['typography.family', /^--(pg-font|font-sajilo)/],
  ['typography.size', /^--pg-text-/],
  ['typography.leading', /^--pg-leading-/],
  ['typography.tracking', /^--pg-tracking-/],
  ['spacing.scale', /^--pg-space-/],
  ['spacing.density', /^--pg-density-/],
  [
    'spacing.component',
    /^--(screen-margin|card-padding|button-height|touch-target|pg-touch-target)$/,
  ],
  [
    'layout',
    /^--(pg-container|pg-hero-y|pg-section-y|pg-gutter|pg-grid-gap|pg-measure|pg-nav-height|pg-sidebar|safe-area)/,
  ],
  ['radius', /^--(radius|pg-radius)/],
  ['shadow', /^--(shadow|pg-shadow)/],
  ['motion', /^--(duration|pg-duration|ease|pg-ease|pg-transition)/],
];

function groupFor(name) {
  for (const [group, pattern] of GROUPS) if (pattern.test(name)) return group;
  return 'other';
}

function setDeep(target, dotted, key, value) {
  let cursor = target;
  for (const part of dotted.split('.')) {
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  cursor[key] = value;
}

const tokens = {};
for (const [name, value] of light) {
  const entry = { $value: value };
  if (dark.has(name) && dark.get(name) !== value) entry.$extensions = { dark: dark.get(name) };
  if (app.has(name) && app.get(name) !== value) {
    entry.$extensions = { ...(entry.$extensions ?? {}), app: app.get(name) };
  }
  setDeep(tokens, groupFor(name), name, entry);
}
for (const [name, value] of dark) {
  if (!light.has(name))
    setDeep(tokens, groupFor(name), name, { $value: value, $extensions: { darkOnly: true } });
}

const themeScale = {};
for (const [name, value] of theme) {
  if (/^--(radius|tracking|font)-/.test(name)) themeScale[name] = { $value: value };
}

const output = {
  $schema: 'https://design-tokens.github.io/community-group/format/',
  meta: {
    name: 'Radix Luma — Nabatable design tokens',
    source: {
      tokens: 'styles/design-system/public-guest.tokens.css',
      theme: 'src/app/globals.css (@theme inline)',
      brand: 'DESIGN.md',
      decisions: 'docs/design/luma-2.0-spec.md',
    },
    generatedBy: 'scripts/design-system/generate-tokens-json.mjs',
    note: 'Generated file — do not edit by hand. $value is the light/default value; $extensions.dark and $extensions.app carry the .dark and [data-theme=app] overrides.',
  },
  tokens,
  theme: themeScale,
};

const json = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== json) {
    console.error('docs/tokens.json is out of date. Run: pnpm design:tokens-json');
    process.exit(1);
  }
  console.log('docs/tokens.json is up to date.');
} else {
  fs.writeFileSync(OUT, json);
  console.log(
    `Wrote ${path.relative(ROOT, OUT)} (${light.size} light tokens, ${dark.size} dark overrides).`,
  );
}
