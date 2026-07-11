#!/usr/bin/env tsx
// MS-foundation-coverage-ratchet: compares the Vitest V8 coverage summary
// against frozen per-scope floors (config/qa/coverage-baseline.json) and
// fails when any scope drops below its floor. `--update-baseline` regenerates
// floors from the current run minus an epsilon, but only ever RAISES them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CoverageMetricCounts = {
  covered: number;
  pct: number;
  total: number;
};

export type CoverageSummaryEntry = {
  branches: CoverageMetricCounts;
  lines: CoverageMetricCounts;
};

export type CoverageSummary = Record<string, CoverageSummaryEntry>;

export type CoverageScopeFloors = {
  branches: number;
  lines: number;
};

export type CoverageBaseline = {
  epsilonPct: number;
  generatedAt: string;
  schemaVersion: 1;
  scopes: Record<string, CoverageScopeFloors>;
};

export type CoverageComparison = {
  failures: string[];
  passed: boolean;
};

export type CoverageBaselineUpdate = {
  baseline: CoverageBaseline;
  kept: string[];
  raised: string[];
};

type CliOptions = {
  baselinePath: string | null;
  summaryPath: string;
  updateBaseline: boolean;
};

export const COVERAGE_METRICS = ['lines', 'branches'] as const;
export const DEFAULT_EPSILON_PCT = 0.2;
export const DEFAULT_SUMMARY_PATH = 'coverage/coverage-summary.json';
export const GLOBAL_SCOPE = 'global';
// Ratchet granularity fixed by the spec: global + these top-level directories.
export const TRACKED_DIRECTORIES = [
  'cloudflare',
  'components',
  'hooks',
  'lib',
  'reserve',
  'scripts',
  'server',
  'src',
] as const;

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function metricCounts(entry: unknown, metric: (typeof COVERAGE_METRICS)[number], context: string): CoverageMetricCounts {
  const counts = (entry as Record<string, unknown> | null)?.[metric] as
    | Record<string, unknown>
    | undefined;
  if (!counts || !isFiniteNumber(counts.total) || !isFiniteNumber(counts.covered)) {
    throw new Error(`Coverage summary entry "${context}" is missing numeric ${metric} counts.`);
  }
  const pct = isFiniteNumber(counts.pct)
    ? counts.pct
    : counts.total === 0
      ? 100
      : roundPct((counts.covered / counts.total) * 100);
  return { covered: counts.covered, pct, total: counts.total };
}

export function readCoverageSummary(summaryPath: string): CoverageSummary {
  if (!fs.existsSync(summaryPath)) {
    throw new Error(
      `Coverage summary not found at ${summaryPath}. Run \`pnpm test:coverage\` first (json-summary reporter).`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Coverage summary at ${summaryPath} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || !('total' in (parsed as object))) {
    throw new Error(`Coverage summary at ${summaryPath} has no "total" entry; refusing to pass.`);
  }

  return parsed as CoverageSummary;
}

// Aggregates the json-summary into per-scope percentages: `global` comes from
// the summary "total" entry; each tracked top-level directory aggregates the
// raw covered/total counts of its files.
export function computeCoverageScopes(
  summary: CoverageSummary,
  rootDir: string = process.cwd(),
): Record<string, CoverageScopeFloors> {
  const scopes: Record<string, CoverageScopeFloors> = {};
  const globalEntry = summary.total;
  scopes[GLOBAL_SCOPE] = {
    branches: metricCounts(globalEntry, 'branches', 'total').pct,
    lines: metricCounts(globalEntry, 'lines', 'total').pct,
  };

  const tracked = new Set<string>(TRACKED_DIRECTORIES);
  const totals = new Map<string, { branches: CoverageMetricCounts; lines: CoverageMetricCounts }>();

  for (const [file, entry] of Object.entries(summary)) {
    if (file === 'total') continue;
    const relative = path.isAbsolute(file) ? path.relative(rootDir, file) : file;
    const [topLevelDirectory] = relative.split(path.sep).join('/').split('/');
    if (!topLevelDirectory || !tracked.has(topLevelDirectory)) continue;

    const bucket = totals.get(topLevelDirectory) ?? {
      branches: { covered: 0, pct: 0, total: 0 },
      lines: { covered: 0, pct: 0, total: 0 },
    };
    for (const metric of COVERAGE_METRICS) {
      const counts = metricCounts(entry, metric, relative);
      bucket[metric].covered += counts.covered;
      bucket[metric].total += counts.total;
    }
    totals.set(topLevelDirectory, bucket);
  }

  for (const directory of TRACKED_DIRECTORIES) {
    const bucket = totals.get(directory);
    if (!bucket) continue;
    scopes[directory] = {
      branches:
        bucket.branches.total === 0
          ? 100
          : roundPct((bucket.branches.covered / bucket.branches.total) * 100),
      lines:
        bucket.lines.total === 0
          ? 100
          : roundPct((bucket.lines.covered / bucket.lines.total) * 100),
    };
  }

  return scopes;
}

export function compareCoverageToBaseline(
  current: Record<string, CoverageScopeFloors>,
  baseline: CoverageBaseline,
): CoverageComparison {
  const failures: string[] = [];

  for (const [scope, floors] of Object.entries(baseline.scopes)) {
    const measured = current[scope];
    if (!measured) {
      failures.push(
        `${scope} has no coverage data in this run but has baseline floors (lines ${floors.lines}%, branches ${floors.branches}%).`,
      );
      continue;
    }
    for (const metric of COVERAGE_METRICS) {
      if (measured[metric] < floors[metric]) {
        failures.push(
          `${scope} ${metric} coverage ${measured[metric].toFixed(2)}% fell below the baseline floor ${floors[metric].toFixed(2)}%.`,
        );
      }
    }
  }

  return {
    failures,
    passed: failures.length === 0,
  };
}

// Regenerates floors as (current - epsilon) but never lowers an existing
// floor: the ratchet is strictly monotonic. Scopes that vanished from the
// current run keep their existing floors so debt cannot be shed by deleting
// coverage.
export function buildUpdatedBaseline(
  current: Record<string, CoverageScopeFloors>,
  existing: CoverageBaseline | null,
  epsilonPct: number = DEFAULT_EPSILON_PCT,
): CoverageBaselineUpdate {
  const kept: string[] = [];
  const raised: string[] = [];
  const scopes: Record<string, CoverageScopeFloors> = {};

  const scopeNames = new Set<string>([
    ...Object.keys(existing?.scopes ?? {}),
    ...Object.keys(current),
  ]);
  const ordered = [
    ...(scopeNames.has(GLOBAL_SCOPE) ? [GLOBAL_SCOPE] : []),
    ...Array.from(scopeNames)
      .filter((scope) => scope !== GLOBAL_SCOPE)
      .sort((left, right) => left.localeCompare(right)),
  ];

  for (const scope of ordered) {
    const existingFloors = existing?.scopes[scope];
    const measured = current[scope];
    const next: CoverageScopeFloors = { branches: 0, lines: 0 };
    let rose = false;

    for (const metric of COVERAGE_METRICS) {
      const candidate = measured ? Math.max(0, roundPct(measured[metric] - epsilonPct)) : 0;
      const existingFloor = existingFloors?.[metric] ?? 0;
      next[metric] = Math.max(existingFloor, candidate);
      if (next[metric] > existingFloor) rose = true;
    }

    scopes[scope] = next;
    if (rose) {
      raised.push(
        `${scope} → lines ${next.lines.toFixed(2)}%, branches ${next.branches.toFixed(2)}% (was lines ${(existingFloors?.lines ?? 0).toFixed(2)}%, branches ${(existingFloors?.branches ?? 0).toFixed(2)}%)`,
      );
    } else if (existingFloors) {
      kept.push(scope);
    }
  }

  return {
    baseline: {
      epsilonPct,
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      scopes,
    },
    kept,
    raised,
  };
}

function parseArgs(argv: readonly string[]): CliOptions {
  let baselinePath: string | null = null;
  let summaryPath = DEFAULT_SUMMARY_PATH;
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
    if (arg === '--summary') {
      summaryPath = argv[index + 1] ?? DEFAULT_SUMMARY_PATH;
      index += 1;
      continue;
    }
    if (arg.startsWith('--summary=')) {
      summaryPath = arg.slice('--summary='.length);
      continue;
    }
    throw new Error(`Unknown coverage ratchet option "${arg}".`);
  }

  return { baselinePath, summaryPath, updateBaseline };
}

function readBaseline(baselinePath: string): CoverageBaseline {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `Coverage baseline not found at ${baselinePath}. Generate it with --update-baseline.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Coverage baseline at ${baselinePath} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
  const baseline = parsed as CoverageBaseline;
  if (baseline?.schemaVersion !== 1 || typeof baseline.scopes !== 'object' || !baseline.scopes) {
    throw new Error(`Coverage baseline at ${baselinePath} has an unexpected shape; refusing to pass.`);
  }
  return baseline;
}

function writeBaseline(baselinePath: string, baseline: CoverageBaseline): void {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}

export function runCoverageRatchet(argv: readonly string[] = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  if (!options.baselinePath) {
    throw new Error('Coverage ratchet requires --baseline <path>.');
  }

  const summary = readCoverageSummary(options.summaryPath);
  const current = computeCoverageScopes(summary);
  const globalScope = current[GLOBAL_SCOPE];

  console.log(
    `[qa:coverage-ratchet] measured global lines ${globalScope.lines.toFixed(2)}% / branches ${globalScope.branches.toFixed(2)}% across ${Object.keys(current).length} scope(s).`,
  );

  if (options.updateBaseline) {
    const existing = fs.existsSync(options.baselinePath) ? readBaseline(options.baselinePath) : null;
    const update = buildUpdatedBaseline(current, existing, DEFAULT_EPSILON_PCT);
    writeBaseline(options.baselinePath, update.baseline);
    console.log(`[qa:coverage-ratchet] updated baseline: ${options.baselinePath}`);
    for (const line of update.raised) {
      console.log(`[qa:coverage-ratchet] floor raised: ${line}`);
    }
    if (update.raised.length === 0) {
      console.log('[qa:coverage-ratchet] no floors rose; existing floors kept (never lowered).');
    } else if (update.kept.length > 0) {
      console.log(
        `[qa:coverage-ratchet] floors kept (never lowered): ${update.kept.join(', ')}.`,
      );
    }
    return 0;
  }

  const comparison = compareCoverageToBaseline(current, readBaseline(options.baselinePath));
  if (comparison.passed) {
    console.log(`[qa:coverage-ratchet] passed baseline ratchet: ${options.baselinePath}`);
    return 0;
  }

  for (const failure of comparison.failures) {
    console.error(`[qa:coverage-ratchet] ${failure}`);
  }
  console.error(
    '[qa:coverage-ratchet] coverage fell below the frozen floors. Add tests (or intentionally re-review the floors) instead of lowering the gate.',
  );
  return 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCoverageRatchet();
  } catch (error) {
    console.error(`[qa:coverage-ratchet] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
