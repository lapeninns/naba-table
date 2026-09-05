import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createLogger, type Logger } from '../backup/log';
import { BACKUP_ID_PATTERN } from '../backup/manifest';
import { loadRecoveryPolicy, type RecoveryPolicy } from '../backup/policy';
import { toGateRecoveryEvidence, type GateRecoveryEvidence } from './evidence';
import {
  DEFAULT_FIXTURES_DIR,
  makeDrillId,
  resolveVerifyRuntime,
  runRestoreDrill,
  type VerifyCliRequest,
  type VerifyRuntime,
} from './verify';

/**
 * Recovery workflow entrypoint (`pnpm recovery:drill`): picks the newest backup in the
 * bucket (or the one given), runs the verification drill against a disposable project
 * and publishes the signed evidence to evidence/recovery/<drillId>.json plus
 * evidence/recovery/latest.json. A gate-shaped copy (`*.gate.json`, the trusted CI
 * RecoveryEvidence contract) is published alongside whenever a manifest was verified.
 */

export const RECOVERY_EVIDENCE_PREFIX = 'evidence/recovery';
export const RECOVERY_LATEST_KEY = `${RECOVERY_EVIDENCE_PREFIX}/latest.json`;
export const RECOVERY_LATEST_GATE_KEY = `${RECOVERY_EVIDENCE_PREFIX}/latest.gate.json`;
export const DRILL_PROJECT_REF_ENV = 'RECOVERY_DRILL_PROJECT_REF';

export type DrillCliRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'run';
      readonly projectRef: string | null;
      readonly backupId: string | null;
      readonly out: string;
      readonly source: 'production' | 'staging';
      readonly dryRun: boolean;
    }
  | { readonly kind: 'refusal'; readonly message: string };

const HELP = `Nabatable recovery drill

Usage: tsx scripts/db/restore/drill.ts [--project-ref <temp ref>] [--backup-id <id>] [--out <dir>]
       [--source production|staging] [--dry-run]
The temp ref may also come from ${DRILL_PROJECT_REF_ENV} (or RESTORE_VERIFY_PROJECT_REF).
See scripts/db/restore/verify.ts for the required environment.
`;

export function parseDrillCliArgs(args: readonly string[]): DrillCliRequest {
  if (args.includes('--help')) return { kind: 'help' };
  const values = new Map<string, string>();
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    const value = args[index + 1];
    if (!arg.startsWith('--') || value === undefined || value.startsWith('--')) {
      return { kind: 'refusal', message: `Invalid argument ${arg}.` };
    }
    if (!['--project-ref', '--backup-id', '--out', '--source'].includes(arg)) {
      return { kind: 'refusal', message: `Unknown option ${arg}.` };
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
  return {
    kind: 'run',
    projectRef: values.get('--project-ref') ?? null,
    backupId,
    out: values.get('--out') ?? path.join('.recovery', 'evidence'),
    source,
    dryRun,
  };
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
  const request = parseDrillCliArgs(args);
  if (request.kind === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (request.kind === 'refusal') {
    io.logger.error(request.message);
    return 2;
  }
  let policy: RecoveryPolicy;
  try {
    policy = loadRecoveryPolicy();
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Failed to load policy.');
    return 2;
  }
  const verifyRequest: Extract<VerifyCliRequest, { kind: 'run' }> = {
    kind: 'run',
    backupId: request.backupId,
    projectRef: request.projectRef ?? env[DRILL_PROJECT_REF_ENV]?.trim() ?? null,
    dryRun: request.dryRun,
    fixturesDir: DEFAULT_FIXTURES_DIR,
    evidenceOut: null,
    source: request.source,
  };
  let runtime: VerifyRuntime;
  try {
    runtime = await resolveVerifyRuntime(verifyRequest, env, policy);
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Drill is unconfigured.');
    return 2;
  }
  if (request.dryRun) {
    io.stdout(
      JSON.stringify(
        { dryRun: true, backupId: runtime.backupId, tempProjectRef: runtime.tempProjectRef },
        null,
        2,
      ),
    );
    return 0;
  }
  const drillId = makeDrillId(io.now(), randomBytes(4).toString('hex'));
  const { signed, manifest } = await runRestoreDrill(
    {
      drillId,
      backupId: runtime.backupId,
      tempProjectRef: runtime.tempProjectRef,
      expectedSourceRef: runtime.expectedSourceRef,
      policy,
    },
    { steps: runtime.steps, now: io.now, signingKey: runtime.signingKey, logger: io.logger },
  );
  const json = Buffer.from(JSON.stringify(signed, null, 2));
  fs.mkdirSync(request.out, { recursive: true });
  fs.writeFileSync(path.join(request.out, `${drillId}.json`), json);
  await runtime.s3.putObject(`${RECOVERY_EVIDENCE_PREFIX}/${drillId}.json`, json, {
    contentType: 'application/json',
  });
  await runtime.s3.putObject(RECOVERY_LATEST_KEY, json, { contentType: 'application/json' });

  let gateEvidence: GateRecoveryEvidence | null = null;
  if (manifest) {
    try {
      gateEvidence = toGateRecoveryEvidence({
        signed,
        backup: manifest,
        environment: request.source,
      });
      const gateJson = Buffer.from(JSON.stringify(gateEvidence, null, 2));
      fs.writeFileSync(path.join(request.out, `${drillId}.gate.json`), gateJson);
      await runtime.s3.putObject(`${RECOVERY_EVIDENCE_PREFIX}/${drillId}.gate.json`, gateJson, {
        contentType: 'application/json',
      });
      await runtime.s3.putObject(RECOVERY_LATEST_GATE_KEY, gateJson, {
        contentType: 'application/json',
      });
    } catch (error) {
      io.logger.warn('Gate-shaped evidence was not emitted', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  io.stdout(
    JSON.stringify({
      drillId,
      backupId: runtime.backupId,
      outcome: signed.evidence.outcome,
      cleanupSucceeded: signed.evidence.cleanup.succeeded,
      gateEvidence: gateEvidence !== null,
    }),
  );
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
