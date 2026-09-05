import { describe, expect, it } from 'vitest';

import {
  classifyLedgerStatus,
  createGatewayLedger,
  decideReplay,
  localDatesEndingAt,
  main,
  parseQueueBacklog,
  parseQueueReconcileArgs,
  parseReconciliationReport,
  reconcileQueue,
  replayCandidates,
  type ReconcileDeps,
  type ReconciliationReport,
} from '../../scripts/cloudflare/recovery/queue-reconcile';

import type { Logger } from '../../scripts/db/backup/log';

const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const NOW = new Date('2026-09-04T12:00:00.000Z');

function deps(overrides: Partial<ReconcileDeps> = {}): ReconcileDeps {
  return {
    queues: { backlog: async (name) => (name.endsWith('-dlq') ? 2 : 0) },
    expected: {
      targets: async () => [
        { restaurantId: 'r1', timezone: 'Europe/London' },
        { restaurantId: 'r2', timezone: 'Europe/London' },
      ],
    },
    ledger: {
      status: async (key) =>
        key.restaurantId === 'r2' && key.localDate === '2026-09-04' ? 'not_sent' : 'sent',
    },
    provider: { messagesSentOn: async () => 3 },
    ...overrides,
  };
}

describe('queue reconciliation report', () => {
  it('parses wrangler backlog output and ledger statuses', () => {
    expect(parseQueueBacklog('Queue Name: q\nBacklog: 12 messages\n')).toBe(12);
    expect(parseQueueBacklog('Queue Name: q\n')).toBeNull();
    expect(classifyLedgerStatus(null)).toBe('not_sent');
    expect(classifyLedgerStatus({ status: 'already_sent' })).toBe('sent');
    expect(classifyLedgerStatus({ status: 'locked' })).toBe('locked');
    expect(classifyLedgerStatus({ status: 'weird' })).toBe('unknown');
    expect(localDatesEndingAt(NOW, 3)).toEqual(['2026-09-02', '2026-09-03', '2026-09-04']);
    expect(() => localDatesEndingAt(NOW, 0)).toThrow(/between 1 and 31/);
  });

  it('flags replay candidates only when the ledger says not sent and a backlog exists', async () => {
    const report = await reconcileQueue(
      {
        environment: 'production',
        queue: 'q',
        deadLetterQueue: 'q-dlq',
        localDates: ['2026-09-03', '2026-09-04'],
        now: NOW,
        drillMode: false,
      },
      deps(),
    );
    expect(report.expectedDispatches).toBe(4);
    expect(report.ledger).toEqual({ sent: 3, not_sent: 1, locked: 0, unknown: 0 });
    expect(report.candidates).toEqual([
      { restaurantId: 'r2', localDate: '2026-09-04', ledgerStatus: 'not_sent' },
    ]);
    expect(report.backlog).toEqual({ queue: 0, deadLetterQueue: 2 });
    expect(report.status).toBe('needs_replay');

    const clean = await reconcileQueue(
      {
        environment: 'production',
        queue: 'q',
        deadLetterQueue: 'q-dlq',
        localDates: ['2026-09-04'],
        now: NOW,
        drillMode: false,
      },
      deps({ queues: { backlog: async () => 0 }, ledger: { status: async () => 'sent' } }),
    );
    expect(clean.status).toBe('clean');

    const unknown = await reconcileQueue(
      {
        environment: 'production',
        queue: 'q',
        deadLetterQueue: 'q-dlq',
        localDates: ['2026-09-04'],
        now: NOW,
        drillMode: false,
      },
      deps({ queues: { backlog: async () => null } }),
    );
    expect(unknown.status).toBe('unknown');
    const providerUnknown = await reconcileQueue(
      {
        environment: 'production',
        queue: 'q',
        deadLetterQueue: null,
        localDates: ['2026-09-04'],
        now: NOW,
        drillMode: false,
      },
      deps({ provider: { messagesSentOn: async () => null } }),
    );
    expect(providerUnknown.status).toBe('unknown');
  });
});

function report(overrides: Partial<ReconciliationReport> = {}): ReconciliationReport {
  return {
    reportVersion: 1,
    generatedAt: NOW.toISOString(),
    environment: 'production',
    worker: 'sms-summary-gateway',
    queue: 'nabatable-sms-daily-summary',
    deadLetterQueue: 'nabatable-sms-daily-summary-dlq',
    backlog: { queue: 0, deadLetterQueue: 2 },
    localDates: ['2026-09-04'],
    expectedDispatches: 2,
    ledger: { sent: 1, not_sent: 1, locked: 0, unknown: 0 },
    providerMessagesByDate: { '2026-09-04': 1 },
    candidates: [{ restaurantId: 'r2', localDate: '2026-09-04', ledgerStatus: 'not_sent' }],
    status: 'needs_replay',
    drillMode: false,
    ...overrides,
  };
}

describe('replay gate', () => {
  const later = new Date(NOW.getTime() + 5 * 60_000);

  it('refuses replay without a report, without confirmation, or with a stale/mismatched/unknown report', () => {
    expect(
      decideReplay({
        report: null,
        environment: 'production',
        confirmReplay: true,
        drillMode: false,
        now: later,
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/no reconciliation report/) });
    expect(
      decideReplay({
        report: report(),
        environment: 'production',
        confirmReplay: false,
        drillMode: false,
        now: later,
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/--confirm-replay/) });
    expect(
      decideReplay({
        report: report({ environment: 'staging' }),
        environment: 'production',
        confirmReplay: true,
        drillMode: false,
        now: later,
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/different environment/) });
    expect(
      decideReplay({
        report: report(),
        environment: 'production',
        confirmReplay: true,
        drillMode: false,
        now: new Date(NOW.getTime() + 2 * 3_600_000),
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/stale/) });
    expect(
      decideReplay({
        report: report({ status: 'unknown' }),
        environment: 'production',
        confirmReplay: true,
        drillMode: false,
        now: later,
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/could not establish/) });
    expect(
      decideReplay({
        report: report({ candidates: [] }),
        environment: 'production',
        confirmReplay: true,
        drillMode: false,
        now: later,
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/no replay candidates/) });
  });

  it('allows replay with a fresh report and forces dryRun in drills and on staging', async () => {
    const production = decideReplay({
      report: report(),
      environment: 'production',
      confirmReplay: true,
      drillMode: false,
      now: later,
    });
    expect(production).toMatchObject({ allowed: true, dryRun: false });
    const drill = decideReplay({
      report: report(),
      environment: 'production',
      confirmReplay: true,
      drillMode: true,
      now: later,
    });
    expect(drill).toMatchObject({ allowed: true, dryRun: true });
    const staging = decideReplay({
      report: report({ environment: 'staging' }),
      environment: 'staging',
      confirmReplay: true,
      drillMode: false,
      now: later,
    });
    expect(staging).toMatchObject({ allowed: true, dryRun: true });
    const drillReport = decideReplay({
      report: report({ drillMode: true }),
      environment: 'production',
      confirmReplay: true,
      drillMode: false,
      now: later,
    });
    expect(drillReport).toMatchObject({ allowed: true, dryRun: true });

    if (!drill.allowed) throw new Error('expected allowed');
    const sent: { dryRun: boolean }[] = [];
    const result = await replayCandidates(drill, {
      replay: async (_key, options) => {
        sent.push(options);
        return options.dryRun ? 'dry_run' : 'queued';
      },
    });
    expect(sent).toEqual([{ dryRun: true }]);
    expect(result).toEqual({ queued: 0, dryRun: 1 });
  });

  it('validates reports read from disk and rejects non-replayable candidates', () => {
    expect(parseReconciliationReport(JSON.parse(JSON.stringify(report()))).candidates).toHaveLength(
      1,
    );
    expect(() => parseReconciliationReport({ ...report(), reportVersion: 2 })).toThrow(
      /unsupported version/,
    );
    expect(() =>
      parseReconciliationReport({
        ...report(),
        candidates: [{ restaurantId: 'r', localDate: '2026-09-04', ledgerStatus: 'sent' }],
      }),
    ).toThrow(/non-replayable/);
    expect(() => parseReconciliationReport({ ...report(), environment: 'prod' })).toThrow(
      /environment/,
    );
  });

  it('the gateway ledger uses dry-run dispatches (never enqueues) to read the idempotency state', async () => {
    const bodies: unknown[] = [];
    const ledger = createGatewayLedger({
      url: 'https://gateway.example.invalid/',
      token: 't',
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({ ok: true, dryRun: true, idempotency: { status: 'already_sent' } }),
          { status: 200 },
        );
      },
    });
    expect(await ledger.status({ restaurantId: 'r1', localDate: '2026-09-04' })).toBe('sent');
    expect(bodies).toEqual([{ restaurantId: 'r1', date: '2026-09-04', dryRun: true }]);
    const failing = createGatewayLedger({
      url: 'https://g',
      token: 't',
      fetch: async () => new Response('nope', { status: 500 }),
    });
    expect(await failing.status({ restaurantId: 'r1', localDate: '2026-09-04' })).toBe('unknown');
  });
});

describe('queue-reconcile CLI', () => {
  const io = { stdout: () => undefined, logger, now: () => NOW, cwd: process.cwd() };

  it('parses args and refuses bad environments or day ranges', () => {
    expect(
      parseQueueReconcileArgs(
        ['--env', 'production', '--days', '2', '--report', 'r.json', '--confirm-replay', '--drill'],
        '/repo',
      ),
    ).toMatchObject({
      kind: 'run',
      envName: 'production',
      days: 2,
      reportPath: 'r.json',
      confirmReplay: true,
      drill: true,
    });
    expect(parseQueueReconcileArgs(['--env', 'prod'], '/repo')).toMatchObject({ kind: 'refusal' });
    expect(parseQueueReconcileArgs(['--env', 'staging', '--days', '99'], '/repo')).toMatchObject({
      kind: 'refusal',
    });
  });

  it('refuses replay without a report (exit 3) and reports unconfigured reconciliation (exit 2)', async () => {
    expect(await main(['--env', 'production', '--confirm-replay'], {}, io)).toBe(3);
    expect(
      await main(
        ['--env', 'production', '--report', '/nonexistent/report.json', '--confirm-replay'],
        {},
        io,
      ),
    ).toBe(3);
    expect(await main(['--env', 'production'], {}, io)).toBe(2);
    expect(await main(['--env', 'staging'], {}, io)).toBe(2);
  });
});
