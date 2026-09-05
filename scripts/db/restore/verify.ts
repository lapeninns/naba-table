import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { BACKUP_ENCRYPTION_KEY_ENV, parseBackupEncryptionKey } from '../backup/encrypt';
import { createLogger, type Logger } from '../backup/log';
import { BACKUP_ID_PATTERN, type BackupManifest } from '../backup/manifest';
import { assertPgClientMajor, createNodeCommandRunner, libpqEnvFromUrl } from '../backup/pg-dump';
import {
  isPlaceholder,
  loadRecoveryPolicy,
  renderPitrState,
  type RecoveryPolicy,
} from '../backup/policy';
import { createS3Client, resolveS3ConfigFromEnv, type S3Client } from '../backup/s3';
import {
  DRILL_STEP_ORDER,
  parseEvidenceSigningKey,
  RECOVERY_EVIDENCE_KEY_ENV,
  signRecoveryEvidence,
  type DrillStepId,
  type DrillStepRecord,
  type RecoveryEvidence,
  type SignedRecoveryEvidence,
} from './evidence';
import { findLatestBackupId } from './latest-backup';
import { createPsqlRunner } from './sql-runner';
import {
  createDefaultRestoreSteps,
  createSupabaseProjectDestroyer,
  SUPABASE_MANAGEMENT_TOKEN_ENV,
  type RestoreContext,
  type RestoreSteps,
} from './steps';

/**
 * Restore verification drill (10 steps) and its CLI:
 *   tsx scripts/db/restore/verify.ts --backup-id <id> --project-ref <disposable temp ref>
 *
 * `scripts/db/safe-run.ts restore-verify` delegates here with `--project-ref` taken from
 * RESTORE_VERIFY_PROJECT_REF; when `--backup-id` is omitted the newest backup in the
 * bucket is verified. Production and staging refs are refused unconditionally.
 */

export const RESTORE_DENYLIST_ENV = 'RESTORE_PROJECT_REF_DENYLIST';
/** Same names as scripts/db/migrations/backup-guard.ts so the delegation is one contract. */
export const RESTORE_TEMP_DB_URL_ENV = 'RESTORE_VERIFY_DB_URL';
export const RESTORE_PROJECT_REF_ENV = 'RESTORE_VERIFY_PROJECT_REF';
export const DEFAULT_FIXTURES_DIR = path.join('tests', 'db', 'fixtures');

export class RestoreRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreRefusal';
  }
}

export function parseDenylist(raw: string | undefined): readonly string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** A drill may only target a disposable project: never production, staging, or a denylisted ref. */
export function assertDisposableProjectRef(
  ref: string,
  policy: RecoveryPolicy,
  env: NodeJS.ProcessEnv,
): string {
  const normalized = ref.trim().toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(normalized)) {
    throw new RestoreRefusal('--project-ref must be a 20-character Supabase project ref.');
  }
  if (normalized === policy.protectedProjectRefs.production) {
    throw new RestoreRefusal('Refusing: --project-ref is the production project.');
  }
  if (normalized === policy.protectedProjectRefs.staging) {
    throw new RestoreRefusal('Refusing: --project-ref is the staging project.');
  }
  if (parseDenylist(env[RESTORE_DENYLIST_ENV]).includes(normalized)) {
    throw new RestoreRefusal(`Refusing: --project-ref is listed in ${RESTORE_DENYLIST_ENV}.`);
  }
  return normalized;
}

export type DrillRunInput = {
  readonly drillId: string;
  readonly backupId: string;
  readonly tempProjectRef: string;
  readonly expectedSourceRef: string;
  readonly policy: RecoveryPolicy;
};

export type DrillRunDeps = {
  readonly steps: RestoreSteps;
  readonly now: () => Date;
  readonly signingKey: Buffer;
  readonly logger: Logger;
};

export type DrillRunResult = {
  readonly signed: SignedRecoveryEvidence;
  /** The verified backup manifest, or null when backup verification itself failed. */
  readonly manifest: BackupManifest | null;
};

type StepOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

function toDetail(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return { value };
}

/**
 * Orchestrates the drill in the fixed DRILL_STEP_ORDER. Outbound schedules are
 * disabled strictly before any data is loaded; destroy always runs (even when an early
 * step throws); evidence always records cleanup success and readiness against the RTO.
 */
export async function runRestoreDrill(
  input: DrillRunInput,
  deps: DrillRunDeps,
): Promise<DrillRunResult> {
  const startedAt = deps.now();
  const records: DrillStepRecord[] = [];
  const ctx: RestoreContext = {
    backupId: input.backupId,
    tempProjectRef: input.tempProjectRef,
    expectedSourceRef: input.expectedSourceRef,
    policy: input.policy,
    now: deps.now,
  };
  let failure: string | null = null;
  let readinessSeconds: number | null = null;
  let manifest: BackupManifest | null = null;
  let cleanup: RecoveryEvidence['cleanup'] = { ran: false, succeeded: false, detail: {} };

  async function step<T>(id: DrillStepId, run: () => Promise<T>): Promise<StepOutcome<T>> {
    const order = DRILL_STEP_ORDER.indexOf(id);
    const began = deps.now();
    try {
      const value = await run();
      const finished = deps.now();
      records.push({
        order,
        id,
        status: 'passed',
        startedAt: began.toISOString(),
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - began.getTime(),
        detail: toDetail(value),
      });
      deps.logger.info('Drill step passed', { step: id });
      return { ok: true, value };
    } catch (error) {
      const finished = deps.now();
      const message = error instanceof Error ? error.message : 'Unknown failure';
      records.push({
        order,
        id,
        status: 'failed',
        startedAt: began.toISOString(),
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - began.getTime(),
        detail: { error: message },
      });
      deps.logger.error('Drill step failed', { step: id, error: message });
      return { ok: false, error: message };
    }
  }

  function skip(id: DrillStepId, reason: string): void {
    const stamp = deps.now().toISOString();
    records.push({
      order: DRILL_STEP_ORDER.indexOf(id),
      id,
      status: 'skipped',
      startedAt: stamp,
      finishedAt: stamp,
      durationMs: 0,
      detail: { reason },
    });
  }

  /** Runs `id` only while no earlier step failed and a manifest is available. */
  async function guarded<T>(
    id: DrillStepId,
    run: (loaded: BackupManifest) => Promise<T>,
  ): Promise<void> {
    const loaded = manifest;
    if (failure !== null || loaded === null) {
      skip(id, failure ?? 'backup verification did not produce a manifest');
      return;
    }
    const outcome = await step(id, () => run(loaded));
    if (!outcome.ok) failure = outcome.error;
  }

  try {
    // 1. Identity, age, integrity and manifest of the backup.
    const verified = await step('verify_backup', () => deps.steps.verifyBackup(ctx));
    if (verified.ok) manifest = verified.value.manifest;
    else failure = verified.error;

    // 2. Outbound schedules and provider integrations are disabled BEFORE any data load.
    if (failure === null) {
      const disabled = await step('disable_outbound', () => deps.steps.disableOutbound(ctx));
      if (!disabled.ok) failure = disabled.error;
    } else {
      skip('disable_outbound', 'backup verification failed');
    }

    // 3. Restore, 4. schema checks, 5. data checks.
    await guarded('restore_data', (loaded) => deps.steps.restoreData(ctx, loaded));
    await guarded('verify_schema', (loaded) => deps.steps.verifySchema(ctx, loaded));
    await guarded('verify_data', (loaded) => deps.steps.verifyData(ctx, loaded));
    if (failure === null) {
      readinessSeconds = Math.round((deps.now().getTime() - startedAt.getTime()) / 1000);
    }

    // 6. Storage objects + encrypted-data recovery, 7. isolation proofs.
    await guarded('verify_storage', (loaded) => deps.steps.verifyStorage(ctx, loaded));
    await guarded('isolation_proofs', () => deps.steps.runIsolationProofs(ctx));

    // 8. Readiness vs RTO.
    const rtoSeconds = input.policy.rtoHours * 3600;
    const readiness = await step('measure_readiness', async () => {
      if (readinessSeconds === null) {
        throw new Error('Database never reached a verified-ready state.');
      }
      if (readinessSeconds > rtoSeconds) {
        throw new Error(`Readiness ${readinessSeconds}s exceeds RTO ${rtoSeconds}s.`);
      }
      return { readinessSeconds, rtoSeconds };
    });
    if (!readiness.ok && failure === null) failure = readiness.error;
  } finally {
    // 9. Destroy temp resources and revoke credentials. Always runs.
    const destroyed = await step('destroy', () => deps.steps.destroy(ctx));
    cleanup = destroyed.ok
      ? { ran: true, succeeded: true, detail: toDetail(destroyed.value) }
      : { ran: true, succeeded: false, detail: { error: destroyed.error } };
  }

  const disableRecord = records.find((record) => record.id === 'disable_outbound');
  const restoreRecord = records.find((record) => record.id === 'restore_data');
  const schedulesDisabledBeforeLoad =
    disableRecord?.status === 'passed' &&
    (restoreRecord === undefined ||
      restoreRecord.status === 'skipped' ||
      Date.parse(disableRecord.finishedAt) <= Date.parse(restoreRecord.startedAt));

  // 10. Evidence.
  const finishedAt = deps.now();
  const stamp = finishedAt.toISOString();
  records.push({
    order: DRILL_STEP_ORDER.indexOf('emit_evidence'),
    id: 'emit_evidence',
    status: 'passed',
    startedAt: stamp,
    finishedAt: stamp,
    durationMs: 0,
    detail: {},
  });
  const withinRto = readinessSeconds !== null && readinessSeconds <= input.policy.rtoHours * 3600;
  const evidence: RecoveryEvidence = {
    evidenceVersion: 1,
    drillId: input.drillId,
    backupId: input.backupId,
    sourceRef: input.expectedSourceRef,
    tempProjectRef: input.tempProjectRef,
    startedAt: startedAt.toISOString(),
    finishedAt: stamp,
    readinessSeconds,
    rtoHours: input.policy.rtoHours,
    withinRto,
    schedulesDisabledBeforeLoad,
    steps: records.slice().sort((a, b) => a.order - b.order),
    cleanup,
    pitrState: input.policy.pitr.state,
    pitrRendered: renderPitrState(input.policy.pitr.state, input.policy.pitr.inspectedAt),
    outcome:
      failure === null && cleanup.succeeded && withinRto && schedulesDisabledBeforeLoad
        ? 'passed'
        : 'failed',
    policyVersion: input.policy.policyVersion,
    activeRuntime: 'node22',
    candidateRuntime: 'node24',
  };
  return { signed: signRecoveryEvidence(evidence, deps.signingKey), manifest };
}

export type VerifyCliRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'run';
      /** null = newest backup in the bucket. */
      readonly backupId: string | null;
      /** null = RESTORE_VERIFY_PROJECT_REF from the environment. */
      readonly projectRef: string | null;
      readonly dryRun: boolean;
      readonly fixturesDir: string;
      readonly evidenceOut: string | null;
      readonly source: 'production' | 'staging';
    }
  | { readonly kind: 'refusal'; readonly message: string };

const HELP = `Nabatable restore verification drill

Usage: tsx scripts/db/restore/verify.ts --backup-id <id> --project-ref <disposable temp ref>
       [--source production|staging] [--fixtures-dir ${DEFAULT_FIXTURES_DIR}] [--evidence-out <file>] [--dry-run]

--backup-id defaults to the newest backup in the bucket; --project-ref defaults to ${RESTORE_PROJECT_REF_ENV}.
Env: ${RESTORE_TEMP_DB_URL_ENV} (temp project DB URL), ${BACKUP_ENCRYPTION_KEY_ENV}, ${RECOVERY_EVIDENCE_KEY_ENV},
     BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY,
     ${SUPABASE_MANAGEMENT_TOKEN_ENV} (to destroy the temp project), optional ${RESTORE_DENYLIST_ENV}
`;

export function parseVerifyCliArgs(args: readonly string[]): VerifyCliRequest {
  if (args.includes('--help')) return { kind: 'help' };
  const values = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (!arg.startsWith('--')) return { kind: 'refusal', message: `Unexpected argument ${arg}.` };
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      return { kind: 'refusal', message: `${arg} requires a value.` };
    }
    values.set(arg, value);
    index += 1;
  }
  const backupId = values.get('--backup-id') ?? null;
  if (backupId !== null && !BACKUP_ID_PATTERN.test(backupId)) {
    return { kind: 'refusal', message: '--backup-id is malformed.' };
  }
  const source = values.get('--source') ?? 'production';
  if (source !== 'production' && source !== 'staging') {
    return { kind: 'refusal', message: '--source must be production or staging.' };
  }
  const known = ['--backup-id', '--project-ref', '--source', '--fixtures-dir', '--evidence-out'];
  const unknown = [...values.keys()].find((name) => !known.includes(name));
  if (unknown) return { kind: 'refusal', message: `Unknown option ${unknown}.` };
  return {
    kind: 'run',
    backupId,
    projectRef: values.get('--project-ref') ?? null,
    dryRun,
    fixturesDir: values.get('--fixtures-dir') ?? DEFAULT_FIXTURES_DIR,
    evidenceOut: values.get('--evidence-out') ?? null,
    source,
  };
}

export function resolveProjectRef(
  request: Extract<VerifyCliRequest, { kind: 'run' }>,
  env: NodeJS.ProcessEnv,
  policy: RecoveryPolicy,
): string {
  const raw = request.projectRef ?? env[RESTORE_PROJECT_REF_ENV]?.trim() ?? '';
  if (!raw) {
    throw new RestoreRefusal(
      `A disposable project ref is required (--project-ref or ${RESTORE_PROJECT_REF_ENV}).`,
    );
  }
  return assertDisposableProjectRef(raw, policy, env);
}

export type VerifyRuntime = {
  readonly policy: RecoveryPolicy;
  readonly steps: RestoreSteps;
  readonly signingKey: Buffer;
  readonly tempProjectRef: string;
  readonly expectedSourceRef: string;
  readonly backupId: string;
  readonly s3: S3Client;
};

/** Build real dependencies from env, refusing loudly when anything is unconfigured. */
export async function resolveVerifyRuntime(
  request: Extract<VerifyCliRequest, { kind: 'run' }>,
  env: NodeJS.ProcessEnv,
  policy: RecoveryPolicy,
): Promise<VerifyRuntime> {
  const tempProjectRef = resolveProjectRef(request, env, policy);
  const expectedSourceRef = policy.protectedProjectRefs[request.source];
  const signingKey = parseEvidenceSigningKey(env[RECOVERY_EVIDENCE_KEY_ENV]);
  const key = parseBackupEncryptionKey(env[BACKUP_ENCRYPTION_KEY_ENV]);
  if (isPlaceholder(policy.bucket)) {
    throw new RestoreRefusal(
      'config/recovery/policy.yaml bucket is a placeholder; drill cannot locate backups.',
    );
  }
  const s3Resolution = resolveS3ConfigFromEnv(env, policy.bucket);
  if (s3Resolution.kind === 'unconfigured') {
    throw new RestoreRefusal(
      `Backup bucket credentials are unconfigured: ${s3Resolution.missing.join(', ')}.`,
    );
  }
  const tempDbUrl = env[RESTORE_TEMP_DB_URL_ENV]?.trim() ?? '';
  if (!tempDbUrl) throw new RestoreRefusal(`${RESTORE_TEMP_DB_URL_ENV} is not set.`);
  let tempUrl: URL;
  try {
    tempUrl = new URL(tempDbUrl);
  } catch {
    throw new RestoreRefusal(`${RESTORE_TEMP_DB_URL_ENV} is not a valid URL.`);
  }
  const hostAndUser = `${tempUrl.hostname} ${decodeURIComponent(tempUrl.username)}`.toLowerCase();
  if (!hostAndUser.includes(tempProjectRef)) {
    throw new RestoreRefusal(
      `${RESTORE_TEMP_DB_URL_ENV} does not reference the temp project ${tempProjectRef}.`,
    );
  }
  if (
    hostAndUser.includes(policy.protectedProjectRefs.production) ||
    hostAndUser.includes(policy.protectedProjectRefs.staging)
  ) {
    throw new RestoreRefusal(`${RESTORE_TEMP_DB_URL_ENV} references a protected project.`);
  }
  const managementToken = env[SUPABASE_MANAGEMENT_TOKEN_ENV]?.trim() ?? '';
  if (!managementToken) {
    throw new RestoreRefusal(
      `${SUPABASE_MANAGEMENT_TOKEN_ENV} is required so the temp project can be destroyed.`,
    );
  }

  const fetchLike = (url: string, init: RequestInit) => fetch(url, init);
  const s3 = createS3Client(s3Resolution.config, { fetch: fetchLike });
  const backupId = request.backupId ?? (await findLatestBackupId(s3));
  if (!backupId) throw new RestoreRefusal('No backups found in the bucket.');

  const runner = createNodeCommandRunner();
  await assertPgClientMajor(runner, 'pg_restore');
  await assertPgClientMajor(runner, 'psql');
  const libpqEnv = libpqEnvFromUrl(tempDbUrl, env);
  const steps = createDefaultRestoreSteps({
    s3,
    key,
    sql: createPsqlRunner(runner, libpqEnv),
    runner,
    libpqEnv,
    destroyer: createSupabaseProjectDestroyer({
      token: managementToken,
      fetch: fetchLike,
      allowedRef: tempProjectRef,
    }),
    revokeCredentials: async () => {
      delete libpqEnv.PGPASSWORD;
      delete env[RESTORE_TEMP_DB_URL_ENV];
      return [RESTORE_TEMP_DB_URL_ENV];
    },
    fixturesDir: request.fixturesDir,
  });
  return { policy, steps, signingKey, tempProjectRef, expectedSourceRef, backupId, s3 };
}

export function makeDrillId(now: Date, randomHex: string): string {
  return `drill-${now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}-${randomHex}`;
}

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: {
    readonly stdout: (line: string) => void;
    readonly logger: Logger;
    readonly now: () => Date;
  },
): Promise<number> {
  const request = parseVerifyCliArgs(args);
  if (request.kind === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (request.kind === 'refusal') {
    io.logger.error(request.message);
    io.stdout(HELP);
    return 2;
  }
  let policy: RecoveryPolicy;
  try {
    policy = loadRecoveryPolicy();
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Failed to load policy.');
    return 2;
  }
  if (request.dryRun) {
    try {
      const tempProjectRef = resolveProjectRef(request, env, policy);
      io.stdout(
        JSON.stringify(
          {
            dryRun: true,
            backupId: request.backupId ?? 'latest',
            tempProjectRef,
            source: request.source,
            steps: DRILL_STEP_ORDER,
          },
          null,
          2,
        ),
      );
      return 0;
    } catch (error) {
      io.logger.error(error instanceof Error ? error.message : 'Refused.');
      return 2;
    }
  }
  let runtime: VerifyRuntime;
  try {
    runtime = await resolveVerifyRuntime(request, env, policy);
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Drill is unconfigured.');
    return 2;
  }
  const { signed } = await runRestoreDrill(
    {
      drillId: makeDrillId(io.now(), randomBytes(4).toString('hex')),
      backupId: runtime.backupId,
      tempProjectRef: runtime.tempProjectRef,
      expectedSourceRef: runtime.expectedSourceRef,
      policy,
    },
    { steps: runtime.steps, now: io.now, signingKey: runtime.signingKey, logger: io.logger },
  );
  const json = JSON.stringify(signed, null, 2);
  if (request.evidenceOut) {
    fs.mkdirSync(path.dirname(request.evidenceOut), { recursive: true });
    fs.writeFileSync(request.evidenceOut, json);
  }
  io.stdout(json);
  return signed.evidence.outcome === 'passed' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), process.env, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    logger: createLogger(),
    now: () => new Date(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Drill failed.'}\n`);
      process.exitCode = 1;
    },
  );
}
