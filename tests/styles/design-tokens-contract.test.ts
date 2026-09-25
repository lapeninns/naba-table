import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Design-token contract.
 *
 * Pins the token layer to the brand spec (DESIGN.md) and
 * the Luma 2.0 decision register so the stylesheet cannot silently drift from
 * the documents that define it — and so retired aliases cannot creep back.
 */

const ROOT = process.cwd();
const TOKENS_CSS = fs.readFileSync(
  path.join(ROOT, 'styles/design-system/public-guest.tokens.css'),
  'utf8',
);
const GLOBALS_CSS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

function block(css: string, marker: string): string {
  const at = css.indexOf(marker);
  if (at === -1) throw new Error(`marker not found: ${marker}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block: ${marker}`);
}

function declarations(cssBlock: string): Map<string, string> {
  const out = new Map<string, string>();
  const stripped = cssBlock.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of stripped.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1], match[2].replace(/\s+/g, ' ').trim());
  }
  return out;
}

const light = declarations(block(TOKENS_CSS, ":root,\n  [data-theme='guest']"));
const dark = declarations(block(TOKENS_CSS, '.dark,\n  :root.dark'));
const app = declarations(block(TOKENS_CSS, "[data-theme='app'] {"));
const theme = declarations(block(GLOBALS_CSS, '@theme inline'));

function hslToHex(triplet: string): string {
  const [h, s, l] = triplet.split(' ').map((part) => Number.parseFloat(part));
  const sat = s / 100;
  const lum = l / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lum - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return `#${[r, g, b]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function channelDistance(a: string, b: string): number {
  const parse = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
}

describe('design tokens — brand palette (DESIGN.md)', () => {
  const brand: Array<[string, string, string]> = [
    // token, light hex, dark hex
    ['--background', '#ffffff', '#09090b'],
    ['--foreground', '#09090b', '#fafafa'],
    ['--card', '#ffffff', '#18181b'],
    ['--primary', '#1447e6', '#193cb8'],
    ['--primary-foreground', '#eff6ff', '#eff6ff'],
    ['--secondary', '#f4f4f5', '#27272a'],
    ['--muted', '#f4f4f5', '#27272a'],
    ['--muted-foreground', '#71717b', '#9f9fa9'],
    ['--border', '#e4e4e7', '#27272a'],
    ['--input', '#e4e4e7', '#3f3f46'],
    ['--ring', '#9f9fa9', '#71717b'],
    ['--destructive', '#e7000b', '#ff6467'],
    ['--chart-1', '#8ec5ff', '#8ec5ff'],
    ['--chart-2', '#2b7fff', '#2b7fff'],
    ['--chart-3', '#155dfc', '#155dfc'],
    ['--chart-4', '#1447e6', '#1447e6'],
    ['--chart-5', '#193cb8', '#193cb8'],
  ];

  it.each(brand)('%s resolves to the brand hex in light and dark (±2/255)', (token, l, d) => {
    expect(light.has(token)).toBe(true);
    const darkValue = dark.get(token) ?? light.get(token)!;
    expect(channelDistance(hslToHex(light.get(token)!), l)).toBeLessThanOrEqual(2);
    expect(channelDistance(hslToHex(darkValue), d)).toBeLessThanOrEqual(2);
  });

  it('keeps cobalt as the single accent and the raw palette in sync with the brand hex', () => {
    expect(light.get('--pg-cobalt')).toBe('#1447e6');
    expect(light.get('--pg-cobalt-hover')).toBe('#1240cf');
    expect(light.get('--pg-action')).toBe('var(--pg-cobalt)');
    expect(light.get('--pg-accent')).toBe('var(--pg-cobalt)');
    expect(light.get('--pg-danger')).toBe('#e7000b');
    expect(light.get('--pg-danger-text')).toBe('#c10007');
    expect(light.get('--pg-secondary-hover')).toBe('#e8e8ea');
    expect(light.get('--sidebar-primary')).toBe('#155dfc');
    expect(dark.get('--pg-line')).toBe('rgb(255 255 255 / 0.1)');
  });

  it('defines a dark variant for every colour that the brand re-tunes', () => {
    for (const token of [
      '--pg-cobalt',
      '--pg-cobalt-tint',
      '--pg-cobalt-glow',
      '--pg-neutral-glow',
      '--pg-danger-text',
      '--pg-secondary-hover',
      '--sidebar',
      '--success',
    ]) {
      expect(dark.has(token), token).toBe(true);
    }
  });
});

describe('design tokens — typography', () => {
  it('display and headline tiers are fluid clamp() steps at the brand bounds', () => {
    expect(light.get('--pg-text-hero')).toBe('clamp(2rem, 5vw, 3rem)');
    expect(light.get('--pg-text-section')).toBe('clamp(1.75rem, 4vw, 2.25rem)');
    expect(light.get('--pg-text-card-title')).toBe('clamp(1.25rem, 3vw, 1.5rem)');
    // Body never scales.
    expect(light.get('--pg-text-body')).toBe('1rem');
    expect(light.get('--pg-text-caption')).toBe('0.875rem');
    expect(light.get('--pg-text-kicker')).toBe('0.75rem');
    expect(light.get('--pg-text-title')).toBe('1.25rem');
    // No breakpoint-stepped override remains for the display tiers.
    expect(TOKENS_CSS).not.toMatch(/@media \(min-width: 768px\)[\s\S]*--pg-text-hero/);
  });

  it('tracking is inversely proportional to size', () => {
    expect(light.get('--pg-tracking-display')).toBe('-0.02em');
    expect(light.get('--pg-tracking-tight')).toBe('-0.01em');
    expect(light.get('--pg-tracking-button')).toBe('0.01em');
    expect(light.get('--pg-tracking-wide')).toBe('0.08em');
    // globals.css must not flatten heading tracking back to zero.
    expect(GLOBALS_CSS).not.toMatch(/h6 \{[^}]*letter-spacing: 0;/);
    expect(theme.get('--tracking-display')).toBe('var(--pg-tracking-display)');
    expect(theme.get('--tracking-button')).toBe('var(--pg-tracking-button)');
  });

  it('leading tokens encode the brand line-heights', () => {
    const expected: Record<string, string> = {
      '--pg-leading-tight': '1.1667',
      '--pg-leading-snug': '1.2222',
      '--pg-leading-heading': '1.3333',
      '--pg-leading-title': '1.4',
      '--pg-leading-compact': '1.4286',
      '--pg-leading-body': '1.5',
      '--pg-leading-lead': '1.5556',
    };
    for (const [token, value] of Object.entries(expected)) {
      expect(light.get(token), token).toBe(value);
    }
  });

  it('ops resolves the display face to the sans body face', () => {
    expect(app.get('--pg-font-display')).toMatch(/--font-radix-luma-body/);
    expect(light.get('--pg-font-display')).toMatch(/Merriweather/);
  });
});

describe('design tokens — spacing, layout, radius', () => {
  it('exposes the 8px spacing scale and fluid rhythm', () => {
    const expected: Record<string, string> = {
      '--pg-space-xs': '0.25rem',
      '--pg-space-sm': '0.5rem',
      '--pg-space-md': '1rem',
      '--pg-space-lg': '1.5rem',
      '--pg-space-xl': '2.5rem',
      '--pg-space-2xl': '4rem',
      '--pg-space-3xl': '6rem',
      '--pg-space-4xl': '8rem',
      '--pg-hero-y': 'clamp(4rem, 10vw, 8rem)',
      '--pg-section-y': 'clamp(2.5rem, 8vw, 6rem)',
      '--pg-grid-gap': 'clamp(1rem, 3vw, 1.5rem)',
      '--pg-container-sm': '48rem',
      '--pg-container-md': '80rem',
      '--pg-container-lg': '96rem',
      '--pg-measure': '65ch',
      '--pg-nav-height': '3rem',
      '--pg-sidebar-width': '16rem',
      '--pg-sidebar-rail': '4rem',
      '--pg-touch-target': '2.75rem',
    };
    for (const [token, value] of Object.entries(expected)) {
      expect(light.get(token), token).toBe(value);
    }
  });

  it('keeps the restrained radius scale identical in the token file and @theme', () => {
    for (const step of ['sm', 'md', 'lg', 'xl']) {
      expect(light.get(`--radius-${step}`), step).toBe(theme.get(`--radius-${step}`));
    }
    expect(theme.get('--radius-4xl')).toBe('1.25rem');
    expect(light.get('--pg-radius-pill')).toBe('999px');
    expect(light.get('--radius-full')).toBe('9999px');
  });

  it('ops density is compact and guest density is comfortable', () => {
    expect(light.get('--pg-density-card-px')).toBe('1.5rem');
    expect(app.get('--pg-density-card-px')).toBe('1rem');
    expect(app.get('--pg-density-control-h')).toBe('2.25rem');
  });
});

describe('design tokens — motion', () => {
  it('matches the brand easing and duration scale', () => {
    expect(light.get('--pg-ease-out')).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)');
    expect(light.get('--pg-ease-spring')).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(light.get('--pg-ease-snap')).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(light.get('--pg-duration-fast')).toBe('150ms');
    expect(light.get('--pg-duration')).toBe('250ms');
    expect(light.get('--pg-duration-slow')).toBe('500ms');
    expect(light.get('--pg-duration-reveal')).toBe('800ms');
  });
});

describe('design tokens — retired aliases stay retired', () => {
  it('has no --guest-* aliases and no dark-only legacy leftovers', () => {
    expect([...light.keys()].filter((k) => k.startsWith('--guest-'))).toEqual([]);
    expect([...dark.keys()].filter((k) => k.startsWith('--guest-'))).toEqual([]);
    const darkOnly = [...dark.keys()].filter((k) => !light.has(k));
    expect(darkOnly).toEqual([]);
  });

  it('keeps only the four surviving --color-* aliases', () => {
    const legacy = [...light.keys()].filter(
      (k) => k.startsWith('--color-') && !/^--color-(neutral|success|warning|error)-/.test(k),
    );
    expect(legacy.sort()).toEqual(
      [
        '--color-primary',
        '--color-surface',
        '--color-text-primary',
        '--color-text-secondary',
      ].sort(),
    );
  });
});

describe('docs/tokens.json export', () => {
  it('is regenerated from the stylesheet (pnpm design:tokens-json)', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [path.join(ROOT, 'scripts/design-system/generate-tokens-json.mjs'), '--check'],
        { cwd: ROOT, stdio: 'pipe' },
      ),
    ).not.toThrow();
  });
});
