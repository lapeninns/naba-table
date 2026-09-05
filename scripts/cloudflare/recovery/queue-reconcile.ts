import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createLogger, type Logger } from '../../db/backup/log';
import {
  createPnpmWranglerRunner,
  envFlags,
  loadWranglerConfig,
  parseWorkerEnvName,
  RecoveryToolError,
  resolveWorkerBindings,
  workerDir,
  type WorkerEnvName,
  type WranglerRunner,
} from './shared';

/**
 * Queue / DLQ reconciliation for the SMS summary gateway.
 *
 * Before ANY replay the backlog of `nabatable-sms-daily-summary` and its DLQ is compared
 * against (a) the application ledger (the DailyBookingSummaryState idempotency record,
 * read through the gateway's dry-run dispatch endpoint, which never enqueues) and (b) the
 * provider ledger (Twilio message counts per day). The result is a reconciliation report.
 * Replay is refused unless a fresh report for the same environment exists and
 * --confirm-replay is passed; in drills every replay is forced to dryRun so no real
 * recipient can ever be reached.
 */

export const QUEUE_WORKER = 'sms-summary-gateway';
export const REPORT_VERSION = 1;
export const REPORT_MAX_AGE_MS = 60 * 60 * 1000;
export const DRILL_ENV = 'RECOVERY_DRILL';
export const RECONCILE_ENV = {
  gatewayUrl: 'QUEUE_RECONCILE_GATEWAY_URL',
  gatewayToken: 'QUEUE_RECONCILE_GATEWAY_TOKEN',
  supabaseUrl: 'QUEUE_RECONCILE_SUPABASE_URL',
  supabaseKey: 'QUEUE_RECONCILE_SUPABASE_KEY',
  twilioAccountSid: 'QUEUE_RECONCILE_TWILIO_ACCOUNT_SID',
  twilioKeySid: 'QUEUE_RECONCILE_TWILIO_API_KEY_SID',
  twilioKeySecret: 'QUEUE_RECONCILE_TWILIO_API_KEY_SECRET',
} as const;

export type LedgerStatus = 'sent' | 'not_sent' | 'locked' | 'unknown';

export type DispatchTarget = { readonly restaurantId: string; readonly timezone: string };
export type DispatchKey = { readonly restaurantId: string; readonly localDate: string };

export type QueueInspector = {
  backlog(queueName: string): Promise<number | null>;
};
export type ExpectedDispatchSource = {
  targets(): Promise<readonly DispatchTarget[]>;
};
export type ApplicationLedger = {
  status(key: DispatchKey): Promise<LedgerStatus>;
};
export type ProviderLedger = {
  messagesSentOn(localDate: string): Promise<number | null>;
};
export type ReplaySink = {
  replay(key: DispatchKey, options: { readonly dryRun: boolean }): Promise<'queued' | 'dry_run'>;
};

export type ReconciliationCandidate = DispatchKey & { readonly ledgerStatus: LedgerStatus };

export type ReconciliationReport = {
  readonly reportVersion: 1;
  readonly generatedAt: string;
  readonly environment: WorkerEnvName;
  readonly worker: string;
  readonly queue: string;
  readonly deadLetterQueue: string | null;
  readonly backlog: { readonly queue: number | null; readonly deadLetterQueue: number | null };
  readonly localDates: readonly string[];
  readonly expectedDispatches: number;
  readonly ledger: Readonly<Record<LedgerStatus, number>>;
  readonly providerMessagesByDate: Readonly<Record<string, number | null>>;
  readonly candidates: readonly ReconciliationCandidate[];
  readonly status: 'clean' | 'needs_replay' | 'unknown';
  readonly drillMode: boolean;
};

export function localDatesEndingAt(now: Date, days: number): readonly string[] {
  if (!Number.isInteger(days) || days < 1 || days > 31) {
    throw new RecoveryToolError('--days must be an integer between 1 and 31.');
  }
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 86_400_000);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

/** Parse the textual `wrangler queues info` output; null when the backlog is not stated. */
export function parseQueueBacklog(stdout: string): number | null {
  const match = stdout.match(/backlog[^\d\n]*?(\d+)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function classifyLedgerStatus(idempotency: unknown): LedgerStatus {
  if (idempotency === null) return 'not_sent';
  if (typeof idempotency !== 'object' || Array.isArray(idempotency)) return 'unknown';
  const status = (idempotency as { status?: unknown }).status;
  if (status === 'already_sent' || status === 'sent') return 'sent';
  if (status === 'locked') return 'locked';
  if (status === 'claimed' || status === 'released' || status === undefined) return 'not_sent';
  return 'unknown';
}

export type ReconcileInput = {
  readonly environment: WorkerEnvName;
  readonly queue: string;
  readonly deadLetterQueue: string | null;
  readonly localDates: readonly string[];
  readonly now: Date;
  readonly drillMode: boolean;
};

export type ReconcileDeps = {
  readonly queues: QueueInspector;
  readonly expected: ExpectedDispatchSource;
  readonly ledger: ApplicationLedger;
  readonly provider: ProviderLedger;
};

export async function reconcileQueue(
  input: ReconcileInput,
  deps: ReconcileDeps,
): Promise<ReconciliationReport> {
  const [queueBacklog, dlqBacklog] = await Promise.all([
    deps.queues.backlog(input.queue),
    input.deadLetterQueue
      ? deps.queues.backlog(input.deadLetterQueue)
      : Promise.resolve<number | null>(0),
  ]);
  const targets = await deps.expected.targets();
  const ledger: Record<LedgerStatus, number> = { sent: 0, not_sent: 0, locked: 0, unknown: 0 };
  const candidates: ReconciliationCandidate[] = [];
  for (const target of targets) {
    for (const localDate of input.localDates) {
      const status = await deps.ledger.status({ restaurantId: target.restaurantId, localDate });
      ledger[status] += 1;
      if (status === 'not_sent' || status === 'locked') {
        candidates.push({ restaurantId: target.restaurantId, localDate, ledgerStatus: status });
      }
    }
  }
  const providerMessagesByDate: Record<string, number | null> = {};
  for (const localDate of input.localDates) {
    providerMessagesByDate[localDate] = await deps.provider.messagesSentOn(localDate);
  }
  const unknown =
    queueBacklog === null ||
    dlqBacklog === null ||
    ledger.unknown > 0 ||
    Object.values(providerMessagesByDate).some((value) => value === null);
  const status: ReconciliationReport['status'] = unknown
    ? 'unknown'
    : candidates.length > 0 && ((dlqBacklog ?? 0) > 0 || (queueBacklog ?? 0) > 0)
      ? 'needs_replay'
      : 'clean';
  return {
    reportVersion: REPORT_VERSION,
    generatedAt: input.now.toISOString(),
    environment: input.environment,
    worker: QUEUE_WORKER,
    queue: input.queue,
    deadLetterQueue: input.deadLetterQueue,
    backlog: { queue: queueBacklog, deadLetterQueue: dlqBacklog },
    localDates: input.localDates,
    expectedDispatches: targets.length * input.localDates.length,
    ledger,
    providerMessagesByDate,
    candidates,
    status,
    drillMode: input.drillMode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseReconciliationReport(raw: unknown): ReconciliationReport {
  if (!isRecord(raw) || raw.reportVersion !== REPORT_VERSION) {
    throw new RecoveryToolError('Reconciliation report is missing or has an unsupported version.');
  }
  if (typeof raw.generatedAt !== 'string' || Number.isNaN(Date.parse(raw.generatedAt))) {
    throw new RecoveryToolError('Reconciliation report generatedAt is invalid.');
  }
  if (raw.environment !== 'staging' && raw.environment !== 'production') {
    throw new RecoveryToolError('Reconciliation report environment is invalid.');
  }
  if (raw.status !== 'clean' && raw.status !== 'needs_replay' && raw.status !== 'unknown') {
    throw new RecoveryToolError('Reconciliation report status is invalid.');
  }
  if (!Array.isArray(raw.candidates))
    throw new RecoveryToolError('Reconciliation report has no candidates array.');
  const candidates = raw.candidates.map((entry): ReconciliationCandidate => {
    if (
      !isRecord(entry) ||
      typeof entry.restaurantId !== 'string' ||
      typeof entry.localDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.localDate)
    ) {
      throw new RecoveryToolError('Reconciliation report candidate is malformed.');
    }
    const ledgerStatus = entry.ledgerStatus;
    if (ledgerStatus !== 'not_sent' && ledgerStatus !== 'locked') {
      throw new RecoveryToolError(
        'Reconciliation report candidate has a non-replayable ledger status.',
      );
    }
    return { restaurantId: entry.restaurantId, localDate: entry.localDate, ledgerStatus };
  });
  return {
    ...(raw as unknown as ReconciliationReport),
    reportVersion: REPORT_VERSION,
    candidates,
    drillMode: raw.drillMode === true,
  };
}

export type ReplayDecision =
  | {
      readonly allowed: true;
      readonly dryRun: boolean;
      readonly candidates: readonly ReconciliationCandidate[];
    }
  | { readonly allowed: false; readonly reason: string };

/** Pure replay gate. Every refusal names the missing precondition. */
export function decideReplay(input: {
  readonly report: ReconciliationReport | null;
  readonly environment: WorkerEnvName;
  readonly confirmReplay: boolean;
  readonly drillMode: boolean;
  readonly now: Date;
}): ReplayDecision {
  if (!input.report) {
    return {
      allowed: false,
      reason: 'Replay refused: no reconciliation report was provided (--report <file>).',
    };
  }
  if (!input.confirmReplay) {
    return { allowed: false, reason: 'Replay refused: --confirm-replay was not passed.' };
  }
  if (input.report.environment !== input.environment) {
    return {
      allowed: false,
      reason: 'Replay refused: the report was produced for a different environment.',
    };
  }
  const ageMs = input.now.getTime() - Date.parse(input.report.generatedAt);
  if (ageMs < 0 || ageMs > REPORT_MAX_AGE_MS) {
    return {
      allowed: false,
      reason:
        'Replay refused: the reconciliation report is stale (older than 1h) or from the future.',
    };
  }
  if (input.report.status === 'unknown') {
    return {
      allowed: false,
      reason:
        'Replay refused: the reconciliation report could not establish backlog or ledger state.',
    };
  }
  if (input.report.candidates.length === 0) {
    return { allowed: false, reason: 'Replay refused: the report lists no replay candidates.' };
  }
  const dryRun = input.drillMode || input.report.drillMode || input.environment === 'staging';
  return { allowed: true, dryRun, candidates: input.report.candidates };
}

export async function replayCandidates(
  decision: Extract<ReplayDecision, { allowed: true }>,
  sink: ReplaySink,
): Promise<{ readonly queued: number; readonly dryRun: number }> {
  let queued = 0;
  let dryRun = 0;
  for (const candidate of decision.candidates) {
    const outcome = await sink.replay(
      { restaurantId: candidate.restaurantId, localDate: candidate.localDate },
      { dryRun: decision.dryRun },
    );
    if (outcome === 'queued') queued += 1;
    else dryRun += 1;
  }
  return { queued, dryRun };
}

// ---- Default (real) adapters. Every one refuses when unconfigured. ----

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function createWranglerQueueInspector(
  wrangler: WranglerRunner,
  dir: string,
  envName: WorkerEnvName,
): QueueInspector {
  return {
    async backlog(queueName) {
      const result = await wrangler.run(dir, ['queues', 'info', queueName, ...envFlags(envName)]);
      if (result.status !== 0) return null;
      return parseQueueBacklog(result.stdout);
    },
  };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim() ?? '';
  if (!value) throw new RecoveryToolError(`${name} is required for queue reconciliation.`);
  return value;
}

export function createGatewayLedger(config: {
  readonly url: string;
  readonly token: string;
  readonly fetch: FetchLike;
}): ApplicationLedger & ReplaySink {
  const endpoint = `${config.url.replace(/\/$/, '')}/internal/dispatch-daily-summary`;
  async function dispatch(
    key: DispatchKey,
    dryRun: boolean,
  ): Promise<Record<string, unknown> | null> {
    const response = await config.fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ restaurantId: key.restaurantId, date: key.localDate, dryRun }),
    });
    if (response.status === 404 || response.status === 409) return null;
    if (!response.ok) throw new RecoveryToolError(`Gateway dispatch returned ${response.status}.`);
    const body: unknown = await response.json();
    return isRecord(body) ? body : null;
  }
  return {
    async status(key) {
      try {
        const body = await dispatch(key, true);
        if (!body) return 'unknown';
        return classifyLedgerStatus(body.idempotency ?? null);
      } catch {
        return 'unknown';
      }
    },
    async replay(key, options) {
      const body = await dispatch(key, options.dryRun);
      if (!body)
        throw new RecoveryToolError('Gateway refused the replay (target missing or disabled).');
      return body.queued === true ? 'queued' : 'dry_run';
    },
  };
}

export function createSupabaseExpectedSource(config: {
  readonly url: string;
  readonly key: string;
  readonly fetch: FetchLike;
}): ExpectedDispatchSource {
  return {
    async targets() {
      const response = await config.fetch(
        `${config.url.replace(/\/$/, '')}/rest/v1/restaurants?select=id,timezone&manager_daily_summary_enabled=eq.true&is_active=eq.true`,
        { method: 'GET', headers: { apikey: config.key, authorization: `Bearer ${config.key}` } },
      );
      if (!response.ok)
        throw new RecoveryToolError(`Restaurant target lookup returned ${response.status}.`);
      const body: unknown = await response.json();
      if (!Array.isArray(body))
        throw new RecoveryToolError('Restaurant target lookup returned no array.');
      return body
        .filter(isRecord)
        .map((row) => ({
          restaurantId: String(row.id ?? ''),
          timezone: String(row.timezone ?? 'UTC'),
        }))
        .filter((row) => row.restaurantId.length > 0);
    },
  };
}

export function createTwilioProviderLedger(config: {
  readonly accountSid: string;
  readonly keySid: string;
  readonly keySecret: string;
  readonly fetch: FetchLike;
}): ProviderLedger {
  const auth = Buffer.from(`${config.keySid}:${config.keySecret}`).toString('base64');
  return {
    async messagesSentOn(localDate) {
      const response = await config.fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json?DateSent=${localDate}&PageSize=1000`,
        { method: 'GET', headers: { authorization: `Basic ${auth}` } },
      );
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.messages)) return null;
      return body.messages.filter((message) => isRecord(message) && message.direction !== 'inbound')
        .length;
    },
  };
}

export type QueueReconcileCliRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'run';
      readonly envName: WorkerEnvName;
      readonly days: number;
      readonly outDir: string;
      readonly repoRoot: string;
      readonly reportPath: string | null;
      readonly confirmReplay: boolean;
      readonly drill: boolean;
    }
  | { readonly kind: 'refusal'; readonly message: string };

const HELP = `Nabatable queue reconciliation (SMS summary gateway)

Usage: tsx scripts/cloudflare/recovery/queue-reconcile.ts --env staging|production [--days 3] [--out <dir>]
       [--report <reconciliation.json> --confirm-replay] [--drill]
Env: ${RECONCILE_ENV.gatewayUrl}, ${RECONCILE_ENV.gatewayToken}, ${RECONCILE_ENV.supabaseUrl}, ${RECONCILE_ENV.supabaseKey},
     ${RECONCILE_ENV.twilioAccountSid}, ${RECONCILE_ENV.twilioKeySid}, ${RECONCILE_ENV.twilioKeySecret}; ${DRILL_ENV}=true forces drill mode.
Exit codes: 0 report written / replay done, 2 unconfigured, 3 replay refused, 1 failure.
`;

export function parseQueueReconcileArgs(
  args: readonly string[],
  cwd: string,
): QueueReconcileCliRequest {
  if (args.includes('--help')) return { kind: 'help' };
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--confirm-replay' || arg === '--drill') {
      flags.add(arg);
      continue;
    }
    const value = args[index + 1];
    if (
      !['--env', '--days', '--out', '--repo-root', '--report'].includes(arg) ||
      value === undefined ||
      value.startsWith('--')
    ) {
      return { kind: 'refusal', message: `Invalid argument ${arg}.` };
    }
    values.set(arg, value);
    index += 1;
  }
  let envName: WorkerEnvName;
  try {
    envName = parseWorkerEnvName(values.get('--env'));
  } catch (error) {
    return { kind: 'refusal', message: error instanceof Error ? error.message : 'Invalid --env.' };
  }
  const days = Number.parseInt(values.get('--days') ?? '3', 10);
  if (!Number.isInteger(days) || days < 1 || days > 31) {
    return { kind: 'refusal', message: '--days must be an integer between 1 and 31.' };
  }
  return {
    kind: 'run',
    envName,
    days,
    outDir: values.get('--out') ?? path.join(cwd, '.recovery', 'queue'),
    repoRoot: values.get('--repo-root') ?? cwd,
    reportPath: values.get('--report') ?? null,
    confirmReplay: flags.has('--confirm-replay'),
    drill: flags.has('--drill'),
  };
}

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: {
    readonly stdout: (line: string) => void;
    readonly logger: Logger;
    readonly now: () => Date;
    readonly cwd: string;
  },
): Promise<number> {
  const request = parseQueueReconcileArgs(args, io.cwd);
  if (request.kind === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (request.kind === 'refusal') {
    io.logger.error(request.message);
    return 2;
  }
  const drillMode = request.drill || env[DRILL_ENV]?.trim().toLowerCase() === 'true';
  const dir = workerDir(request.repoRoot, QUEUE_WORKER);
  let consumer;
  try {
    const resolution = resolveWorkerBindings(loadWranglerConfig(dir), request.envName);
    if (resolution.kind === 'unconfigured') {
      io.logger.error('Queue bindings are unconfigured.', {
        placeholders: resolution.placeholders,
      });
      return 2;
    }
    consumer = resolution.bindings.queueConsumers[0];
    if (!consumer)
      throw new RecoveryToolError(`${QUEUE_WORKER} has no queue consumer for ${request.envName}.`);
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Failed to read wrangler config.');
    return 2;
  }

  // Replay path: needs an existing report, never generates one implicitly.
  if (request.confirmReplay || request.reportPath) {
    let report: ReconciliationReport | null = null;
    try {
      report = request.reportPath
        ? parseReconciliationReport(JSON.parse(fs.readFileSync(request.reportPath, 'utf8')))
        : null;
    } catch (error) {
      io.logger.error(
        error instanceof Error ? error.message : 'Failed to read the reconciliation report.',
      );
      return 3;
    }
    const decision = decideReplay({
      report,
      environment: request.envName,
      confirmReplay: request.confirmReplay,
      drillMode,
      now: io.now(),
    });
    if (!decision.allowed) {
      io.logger.error(decision.reason);
      return 3;
    }
    let sink: ReplaySink;
    try {
      sink = createGatewayLedger({
        url: requireEnv(env, RECONCILE_ENV.gatewayUrl),
        token: requireEnv(env, RECONCILE_ENV.gatewayToken),
        fetch: (url, init) => fetch(url, init),
      });
    } catch (error) {
      io.logger.error(error instanceof Error ? error.message : 'Replay sink is unconfigured.');
      return 2;
    }
    const result = await replayCandidates(decision, sink);
    io.stdout(JSON.stringify({ replayed: result, dryRun: decision.dryRun, drillMode }));
    return 0;
  }

  let deps: ReconcileDeps;
  try {
    const fetchLike: FetchLike = (url, init) => fetch(url, init);
    deps = {
      queues: createWranglerQueueInspector(createPnpmWranglerRunner(env), dir, request.envName),
      expected: createSupabaseExpectedSource({
        url: requireEnv(env, RECONCILE_ENV.supabaseUrl),
        key: requireEnv(env, RECONCILE_ENV.supabaseKey),
        fetch: fetchLike,
      }),
      ledger: createGatewayLedger({
        url: requireEnv(env, RECONCILE_ENV.gatewayUrl),
        token: requireEnv(env, RECONCILE_ENV.gatewayToken),
        fetch: fetchLike,
      }),
      provider: createTwilioProviderLedger({
        accountSid: requireEnv(env, RECONCILE_ENV.twilioAccountSid),
        keySid: requireEnv(env, RECONCILE_ENV.twilioKeySid),
        keySecret: requireEnv(env, RECONCILE_ENV.twilioKeySecret),
        fetch: fetchLike,
      }),
    };
  } catch (error) {
    io.logger.error(
      error instanceof Error ? error.message : 'Queue reconciliation is unconfigured.',
    );
    return 2;
  }
  try {
    const now = io.now();
    const report = await reconcileQueue(
      {
        environment: request.envName,
        queue: consumer.queue,
        deadLetterQueue: consumer.deadLetterQueue,
        localDates: localDatesEndingAt(now, request.days),
        now,
        drillMode,
      },
      deps,
    );
    fs.mkdirSync(request.outDir, { recursive: true });
    const file = path.join(
      request.outDir,
      `queue-reconcile-${request.envName}-${now
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')}.json`,
    );
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    io.stdout(
      JSON.stringify({
        report: file,
        status: report.status,
        candidates: report.candidates.length,
        backlog: report.backlog,
      }),
    );
    return 0;
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Queue reconciliation failed.');
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    logger: createLogger(),
    now: () => new Date(),
    cwd: process.cwd(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Queue reconciliation failed.'}\n`,
      );
      process.exitCode = 1;
    },
  );
}
