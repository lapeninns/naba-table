import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createLogger, type Logger } from '../backup/log';
import { backupManifestKey, validateBackupManifest, type BackupManifest } from '../backup/manifest';
import {
  isPitrEffectivelyEnabled,
  loadRecoveryPolicy,
  renderPitrState,
  type RecoveryPolicy,
} from '../backup/policy';
import { createS3Client, resolveS3ConfigFromEnv } from '../backup/s3';
import { RECOVERY_LATEST_KEY } from './drill';
import { findLatestBackupId } from './latest-backup';
import {
  parseEvidenceSigningKey,
  parseSignedRecoveryEvidence,
  RECOVERY_EVIDENCE_KEY_ENV,
  verifyRecoveryEvidenceSignature,
  type SignedRecoveryEvidence,
} from './evidence';

/**
 * Deploy-time recovery evidence gate (`pnpm recovery:evidence:check`).
 *
 * Exit codes: 0 = ok, 10 = warn (thresholds approaching), 20 = block (stale, failed,
 * unsigned or missing evidence / backup), 2 = unconfigured or bad usage (also blocks).
 */

export const EXIT_OK = 0;
export const EXIT_WARN = 10;
export const EXIT_BLOCK = 20;
export const EXIT_UNCONFIGURED = 2;

export type CheckStatus = 'ok' | 'warn' | 'block';

export type Finding = { readonly level: 'info' | 'warn' | 'block'; readonly message: string };

export type EvidenceEvaluation = {
  readonly status: CheckStatus;
  readonly findings: readonly Finding[];
};

export type EvaluateInput = {
  readonly evidence: SignedRecoveryEvidence | null;
  readonly signatureValid: boolean;
  readonly backupManifest: BackupManifest | null;
  readonly policy: RecoveryPolicy;
  readonly now: Date;
};

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / 3_600_000;
}

/** Pure evaluation; never reads env or the clock. */
export function evaluateRecoveryEvidence(input: EvaluateInput): EvidenceEvaluation {
  const findings: Finding[] = [];
  const { policy, now } = input;
  const block = (message: string) => findings.push({ level: 'block', message });
  const warn = (message: string) => findings.push({ level: 'warn', message });
  const info = (message: string) => findings.push({ level: 'info', message });

  // Drill evidence freshness and validity.
  if (!input.evidence) {
    block('No recovery drill evidence found.');
  } else if (!input.signatureValid) {
    block('Recovery drill evidence signature is invalid.');
  } else {
    const evidence = input.evidence.evidence;
    const ageDays = hoursSince(evidence.finishedAt, now) / 24;
    if (Number.isNaN(ageDays) || ageDays < 0) {
      block('Recovery drill evidence has an invalid or future timestamp.');
    } else if (evidence.outcome !== 'passed') {
      block(`Latest recovery drill ${evidence.drillId} did not pass.`);
    } else if (!evidence.cleanup.ran || !evidence.cleanup.succeeded) {
      block(`Latest recovery drill ${evidence.drillId} did not clean up its temporary resources.`);
    } else if (!evidence.schedulesDisabledBeforeLoad) {
      block(
        `Latest recovery drill ${evidence.drillId} loaded data before disabling outbound schedules.`,
      );
    } else if (!evidence.withinRto) {
      block(`Latest recovery drill ${evidence.drillId} exceeded the ${policy.rtoHours}h RTO.`);
    } else if (ageDays > policy.drill.maxSuccessfulAgeDays) {
      block(
        `Latest successful drill is ${ageDays.toFixed(1)} days old; blocks at ${policy.drill.maxSuccessfulAgeDays} days.`,
      );
    } else if (ageDays > policy.drill.warnAtDays) {
      warn(
        `Latest successful drill is ${ageDays.toFixed(1)} days old; warns at ${policy.drill.warnAtDays} days.`,
      );
    } else {
      info(`Latest successful drill ${evidence.drillId} is ${ageDays.toFixed(1)} days old.`);
    }
    if (evidence.policyVersion !== policy.policyVersion) {
      block('Recovery drill evidence was produced under a different policy version.');
    }
    if (evidence.sourceRef !== policy.protectedProjectRefs.production) {
      block('Recovery drill evidence does not cover the production project.');
    }
    // PITR representation: evidence must render exactly what the policy allows.
    const expectedRendering = renderPitrState(policy.pitr.state, policy.pitr.inspectedAt);
    if (evidence.pitrState !== policy.pitr.state || evidence.pitrRendered !== expectedRendering) {
      block('Recovery drill evidence misrepresents the PITR state.');
    } else if (
      /\benabled\b/i.test(evidence.pitrRendered) &&
      !/not enabled/i.test(evidence.pitrRendered) &&
      !isPitrEffectivelyEnabled(policy.pitr.state, policy.pitr.inspectedAt)
    ) {
      block('PITR is rendered as enabled without an inspected enabled state.');
    } else {
      info(evidence.pitrRendered);
    }
  }

  // Backup freshness.
  if (!input.backupManifest) {
    block('No independent backup manifest found.');
  } else {
    const ageHours = hoursSince(input.backupManifest.createdAt, now);
    if (Number.isNaN(ageHours) || ageHours < 0) {
      block('Latest backup has an invalid or future timestamp.');
    } else if (ageHours > policy.independentBackup.maxAgeHours) {
      block(
        `Latest backup is ${ageHours.toFixed(1)}h old; blocks at ${policy.independentBackup.maxAgeHours}h.`,
      );
    } else if (ageHours > policy.independentBackup.warnAtHours) {
      warn(
        `Latest backup is ${ageHours.toFixed(1)}h old; warns at ${policy.independentBackup.warnAtHours}h.`,
      );
    } else {
      info(`Latest backup ${input.backupManifest.backupId} is ${ageHours.toFixed(1)}h old.`);
    }
    if (input.backupManifest.sourceRef !== policy.protectedProjectRefs.production) {
      block('Latest backup does not come from the production project.');
    }
    if (input.backupManifest.pitrState !== policy.pitr.state) {
      block('Latest backup manifest disagrees with the policy PITR state.');
    }
  }

  const status: CheckStatus = findings.some((finding) => finding.level === 'block')
    ? 'block'
    : findings.some((finding) => finding.level === 'warn')
      ? 'warn'
      : 'ok';
  return { status, findings };
}

export function exitCodeFor(status: CheckStatus): number {
  return status === 'ok' ? EXIT_OK : status === 'warn' ? EXIT_WARN : EXIT_BLOCK;
}

export type EvidenceCheckCliRequest =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'run';
      readonly evidencePath: string | null;
      readonly manifestPath: string | null;
      readonly json: boolean;
    }
  | { readonly kind: 'refusal'; readonly message: string };

const HELP = `Nabatable recovery evidence check

Usage: tsx scripts/db/restore/evidence-check.ts [--evidence <file>] [--backup-manifest <file>] [--json]
Without file arguments the latest evidence and backup manifest are read from the backup bucket.
Exit codes: 0 ok, 10 warn, 20 block, 2 unconfigured.
`;

export function parseEvidenceCheckArgs(args: readonly string[]): EvidenceCheckCliRequest {
  if (args.includes('--help')) return { kind: 'help' };
  const values = new Map<string, string>();
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--json') {
      json = true;
      continue;
    }
    const value = args[index + 1];
    if (
      !['--evidence', '--backup-manifest'].includes(arg) ||
      value === undefined ||
      value.startsWith('--')
    ) {
      return { kind: 'refusal', message: `Invalid argument ${arg}.` };
    }
    values.set(arg, value);
    index += 1;
  }
  return {
    kind: 'run',
    evidencePath: values.get('--evidence') ?? null,
    manifestPath: values.get('--backup-manifest') ?? null,
    json,
  };
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
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
  const request = parseEvidenceCheckArgs(args);
  if (request.kind === 'help') {
    io.stdout(HELP);
    return EXIT_OK;
  }
  if (request.kind === 'refusal') {
    io.logger.error(request.message);
    return EXIT_UNCONFIGURED;
  }
  let policy: RecoveryPolicy;
  let signingKey: Buffer;
  try {
    policy = loadRecoveryPolicy();
    signingKey = parseEvidenceSigningKey(env[RECOVERY_EVIDENCE_KEY_ENV]);
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Evidence check is unconfigured.');
    return EXIT_UNCONFIGURED;
  }

  let evidence: SignedRecoveryEvidence | null = null;
  let backupManifest: BackupManifest | null = null;
  try {
    if (request.evidencePath && request.manifestPath) {
      evidence = parseSignedRecoveryEvidence(readJsonFile(request.evidencePath));
      backupManifest = validateBackupManifest(readJsonFile(request.manifestPath));
    } else {
      const s3Resolution = resolveS3ConfigFromEnv(env, policy.bucket);
      if (s3Resolution.kind === 'unconfigured' || policy.bucket.startsWith('REPLACE_ME_')) {
        io.logger.error(
          'Backup bucket is unconfigured; pass --evidence and --backup-manifest or configure BACKUP_S3_*.',
        );
        return EXIT_UNCONFIGURED;
      }
      const s3 = createS3Client(s3Resolution.config, { fetch: (url, init) => fetch(url, init) });
      const rawEvidence = request.evidencePath
        ? readJsonFile(request.evidencePath)
        : await s3
            .getObject(RECOVERY_LATEST_KEY)
            .then((b) => (b ? (JSON.parse(b.toString('utf8')) as unknown) : null));
      evidence = rawEvidence ? parseSignedRecoveryEvidence(rawEvidence) : null;
      if (request.manifestPath) {
        backupManifest = validateBackupManifest(readJsonFile(request.manifestPath));
      } else {
        const latest = await findLatestBackupId(s3);
        const rawManifest = latest ? await s3.getObject(backupManifestKey(latest)) : null;
        backupManifest = rawManifest
          ? validateBackupManifest(JSON.parse(rawManifest.toString('utf8')))
          : null;
      }
    }
  } catch (error) {
    io.logger.error(error instanceof Error ? error.message : 'Failed to read evidence.');
    return EXIT_BLOCK;
  }

  const evaluation = evaluateRecoveryEvidence({
    evidence,
    signatureValid: evidence ? verifyRecoveryEvidenceSignature(evidence, signingKey) : false,
    backupManifest,
    policy,
    now: io.now(),
  });
  if (request.json) {
    io.stdout(JSON.stringify(evaluation, null, 2));
  } else {
    for (const finding of evaluation.findings) io.stdout(`[${finding.level}] ${finding.message}`);
    io.stdout(`recovery evidence: ${evaluation.status}`);
  }
  return exitCodeFor(evaluation.status);
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
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Evidence check failed.'}\n`,
      );
      process.exitCode = EXIT_BLOCK;
    },
  );
}
