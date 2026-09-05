import type { CoverageDetail } from '../executor/types';

/**
 * Reads an Istanbul/V8 `coverage-summary.json` (`{ total: { lines: { pct } ... } }`).
 * Returns null when the document does not have the expected shape rather than
 * guessing, so a missing or corrupt summary is visible as "no coverage evidence".
 */
export function parseCoverageSummary(source: string, json: string): CoverageDetail | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const total = (parsed as Record<string, unknown>).total;
  if (typeof total !== 'object' || total === null) return null;
  const record = total as Record<string, unknown>;
  const pct = (metric: string): number | null => {
    const entry = record[metric];
    if (typeof entry !== 'object' || entry === null) return null;
    const value = (entry as Record<string, unknown>).pct;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const lines = pct('lines');
  const statements = pct('statements');
  const functions = pct('functions');
  const branches = pct('branches');
  if (lines === null || statements === null || functions === null || branches === null) {
    return null;
  }
  return { lines, statements, functions, branches, source };
}
