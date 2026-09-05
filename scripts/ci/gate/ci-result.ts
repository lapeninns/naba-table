import { isImageDigest, parseCiRequestTuple, type CiRequestTuple } from './tuple';

/**
 * Evidence document published by the local controller (or the hosted fallback)
 * inside the check-run `output.text`, wrapped in a fenced ```json block that
 * starts with the marker comment below. The gate is the only consumer that may
 * turn this document into a merge or deploy decision.
 */

export const CI_RESULT_SCHEMA = 'nabatable.ci-result/v1';
export const CI_RESULT_MARKER = '<!-- nabatable-ci-result -->';

export type SuiteStatus = 'passed' | 'failed' | 'skipped';

export type SuiteResult = {
  id: string;
  name: string;
  status: SuiteStatus;
  evidenceDigest: string;
  durationMs?: number;
};

export type CiResultSource = 'local' | 'hosted-fallback';

export type CiResult = {
  schema: typeof CI_RESULT_SCHEMA;
  source: CiResultSource;
  tuple: CiRequestTuple;
  /** Local controller only: the GitHub App installation that produced the check. */
  installationId?: number;
  /** Hosted fallback only: the workflow run that produced the evidence. */
  runId?: number;
  suites: SuiteResult[];
  coverage: { status: 'passed' | 'failed'; evidenceDigest: string };
  evidence: { bundleDigest: string; location?: string };
  startedAt: string;
  completedAt: string;
};

export type CiResultParse = { ok: true; result: CiResult } | { ok: false; errors: string[] };

const SUITE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseSuite(raw: unknown, index: number, errors: string[]): SuiteResult | null {
  if (!isRecord(raw)) {
    errors.push(`suites[${index}] must be an object`);
    return null;
  }
  const { id, name, status, evidenceDigest, durationMs } = raw;
  if (typeof id !== 'string' || !SUITE_ID_PATTERN.test(id)) {
    errors.push(`suites[${index}].id must be a kebab-case identifier`);
    return null;
  }
  if (typeof name !== 'string' || name.length === 0) {
    errors.push(`suites[${index}].name must be a non-empty string`);
    return null;
  }
  if (status !== 'passed' && status !== 'failed' && status !== 'skipped') {
    errors.push(`suites[${index}].status must be passed|failed|skipped`);
    return null;
  }
  if (!isImageDigest(evidenceDigest)) {
    errors.push(`suites[${index}].evidenceDigest must be sha256:<64 hex>`);
    return null;
  }
  const suite: SuiteResult = { id, name, status, evidenceDigest };
  if (durationMs !== undefined) {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
      errors.push(`suites[${index}].durationMs must be a non-negative number when present`);
      return null;
    }
    suite.durationMs = durationMs;
  }
  return suite;
}

export function parseCiResult(raw: unknown): CiResultParse {
  if (!isRecord(raw)) return { ok: false, errors: ['ci result must be an object'] };
  const errors: string[] = [];

  if (raw.schema !== CI_RESULT_SCHEMA) errors.push(`schema must be ${CI_RESULT_SCHEMA}`);
  const source = raw.source;
  if (source !== 'local' && source !== 'hosted-fallback') {
    errors.push('source must be local|hosted-fallback');
  }

  const tupleParse = parseCiRequestTuple(raw.tuple);
  if (!tupleParse.ok) errors.push(...tupleParse.errors.map((error) => `tuple: ${error}`));

  if (source === 'local' && !isPositiveInteger(raw.installationId)) {
    errors.push('installationId must be a positive integer for local evidence');
  }
  if (source === 'hosted-fallback' && !isPositiveInteger(raw.runId)) {
    errors.push('runId must be a positive integer for hosted-fallback evidence');
  }

  const suites: SuiteResult[] = [];
  if (!Array.isArray(raw.suites)) {
    errors.push('suites must be an array');
  } else {
    raw.suites.forEach((entry, index) => {
      const suite = parseSuite(entry, index, errors);
      if (suite) suites.push(suite);
    });
    const ids = new Set<string>();
    for (const suite of suites) {
      if (ids.has(suite.id)) errors.push(`suite "${suite.id}" is listed more than once`);
      ids.add(suite.id);
    }
  }

  const coverage = raw.coverage;
  if (
    !isRecord(coverage) ||
    (coverage.status !== 'passed' && coverage.status !== 'failed') ||
    !isImageDigest(coverage.evidenceDigest)
  ) {
    errors.push('coverage must carry status passed|failed and a sha256 evidenceDigest');
  }

  const evidence = raw.evidence;
  if (!isRecord(evidence) || !isImageDigest(evidence.bundleDigest)) {
    errors.push('evidence.bundleDigest must be sha256:<64 hex>');
  } else if (
    evidence.location !== undefined &&
    (typeof evidence.location !== 'string' || !isHttpsUrl(evidence.location))
  ) {
    errors.push('evidence.location must be an https URL when present');
  }

  if (!isIsoDate(raw.startedAt)) errors.push('startedAt must be an ISO timestamp');
  if (!isIsoDate(raw.completedAt)) errors.push('completedAt must be an ISO timestamp');

  if (errors.length > 0 || !tupleParse.ok || !isRecord(coverage) || !isRecord(evidence)) {
    return { ok: false, errors };
  }

  const result: CiResult = {
    schema: CI_RESULT_SCHEMA,
    source: source as CiResultSource,
    tuple: tupleParse.tuple,
    suites,
    coverage: {
      status: coverage.status as 'passed' | 'failed',
      evidenceDigest: coverage.evidenceDigest as string,
    },
    evidence: { bundleDigest: evidence.bundleDigest as string },
    startedAt: raw.startedAt as string,
    completedAt: raw.completedAt as string,
  };
  if (typeof evidence.location === 'string') result.evidence.location = evidence.location;
  if (isPositiveInteger(raw.installationId)) result.installationId = raw.installationId;
  if (isPositiveInteger(raw.runId)) result.runId = raw.runId;
  return { ok: true, result };
}

/**
 * Extracts the evidence JSON from a check-run output text. Accepts either the
 * marker + fenced block form or a bare JSON document.
 */
export function extractCiResultDocument(outputText: string | null | undefined): unknown {
  if (!outputText) return null;
  const fenced = /```json\s*\n([\s\S]*?)\n```/.exec(outputText);
  const candidate = fenced ? fenced[1] : outputText;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

export function formatCiResultDocument(result: CiResult): string {
  return `${CI_RESULT_MARKER}\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
}
