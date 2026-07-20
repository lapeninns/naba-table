import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeClientErrorFingerprint,
  isClientErrorReportingEnabled,
  resetClientErrorReporterForTests,
  shouldSendClientErrorReport,
} from '@/lib/monitoring/clientReporter';

describe('client error reporter gating', () => {
  beforeEach(() => {
    resetClientErrorReporterForTests();
    vi.unstubAllEnvs();
  });

  it('never reports outside production builds', () => {
    // NODE_ENV is `test` under vitest.
    expect(isClientErrorReportingEnabled()).toBe(false);
  });

  it('never reports from localhost even in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    // jsdom default location is localhost.
    expect(window.location.hostname).toBe('localhost');
    expect(isClientErrorReportingEnabled()).toBe(false);
  });

  it('never reports from preview deployments', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
    expect(isClientErrorReportingEnabled()).toBe(false);
  });
});

describe('client error reporter session budgets', () => {
  beforeEach(() => {
    resetClientErrorReporterForTests();
  });

  const errorCandidate = (message: string, stack: string | null = 'Error\n    at a (/x.js:1:1)') =>
    ({ type: 'error', message, stack }) as const;

  it('suppresses duplicate fingerprints after the per-fingerprint cap', () => {
    let now = 0;
    const next = () => (now += 10_000);

    expect(shouldSendClientErrorReport(errorCandidate('boom'), next()).send).toBe(true);
    expect(shouldSendClientErrorReport(errorCandidate('boom'), next()).send).toBe(true);
    expect(shouldSendClientErrorReport(errorCandidate('boom'), next()).send).toBe(true);
    expect(shouldSendClientErrorReport(errorCandidate('boom'), next()).send).toBe(false);
    // A different error still reports.
    expect(shouldSendClientErrorReport(errorCandidate('other failure'), next()).send).toBe(true);
  });

  it('throttles bursts regardless of fingerprint', () => {
    expect(shouldSendClientErrorReport(errorCandidate('a'), 1_000).send).toBe(true);
    expect(shouldSendClientErrorReport(errorCandidate('b'), 1_500).send).toBe(false);
    expect(shouldSendClientErrorReport(errorCandidate('b'), 4_000).send).toBe(true);
  });

  it('caps the total number of reports per session', () => {
    let now = 0;
    let sent = 0;
    for (let index = 0; index < 40; index += 1) {
      now += 10_000;
      if (shouldSendClientErrorReport(errorCandidate(`unique error ${index}`), now).send) {
        sent += 1;
      }
    }
    expect(sent).toBe(20);
  });

  it('sends at most one generic Script error per session', () => {
    expect(
      shouldSendClientErrorReport({ type: 'error', message: 'Script error.', stack: null }, 10_000)
        .send,
    ).toBe(true);
    expect(
      shouldSendClientErrorReport({ type: 'error', message: 'Script error.', stack: null }, 60_000)
        .send,
    ).toBe(false);
  });

  it('never sends reports with an empty message (previously invalid_payload rejections)', () => {
    expect(
      shouldSendClientErrorReport({ type: 'error', message: '   ', stack: null }, 10_000).send,
    ).toBe(false);
    expect(
      shouldSendClientErrorReport({ type: 'error', message: '', stack: 'stack' }, 20_000).send,
    ).toBe(false);
  });

  it('produces stable fingerprints keyed on type, message, stack head, and path', () => {
    const one = computeClientErrorFingerprint({
      type: 'error',
      message: 'boom',
      stack: 'Error: boom\n    at a (/x.js:1:1)',
      path: '/book',
    });
    const same = computeClientErrorFingerprint({
      type: 'error',
      message: 'boom',
      stack: 'Error: boom\n    at a (/x.js:1:1)',
      path: '/book',
    });
    const different = computeClientErrorFingerprint({
      type: 'unhandledrejection',
      message: 'boom',
      stack: 'Error: boom\n    at a (/x.js:1:1)',
      path: '/book',
    });
    expect(one).toBe(same);
    expect(one).toMatch(/^f[0-9a-f]+$/);
    expect(one).not.toBe(different);
  });
});
