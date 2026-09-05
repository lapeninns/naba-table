import path from 'node:path';
import process from 'node:process';

import {
  isRecord,
  readJsonEvidence,
  requireSha,
  requireString,
  writeJsonEvidence,
} from './evidence';
import { flagString, parseFlags, runOrThrow, spawnCommandRunner, type CommandRunner } from './exec';
import { assertProviderCli } from './provider-clis';

import type { VercelDeploymentEvidence } from './vercel-prebuilt';

export class PromotionRefusedError extends Error {
  constructor(message: string) {
    super(`Refusing to promote: ${message}`);
    this.name = 'PromotionRefusedError';
  }
}

/**
 * A deployment may be promoted only when its evidence proves a production-configured,
 * readiness-verified build whose reported revision matches the expected source SHA.
 */
export function assertPromotable(
  evidence: unknown,
  expectations: { readonly expectedRevision?: string } = {},
): VercelDeploymentEvidence {
  if (!isRecord(evidence)) throw new PromotionRefusedError('evidence is not an object.');
  const context = 'deployment evidence';
  if (evidence.kind !== 'vercel-deployment') {
    throw new PromotionRefusedError(`${context} kind must be "vercel-deployment".`);
  }
  if (evidence.target !== 'production') {
    throw new PromotionRefusedError(
      `${context} target is "${String(evidence.target)}", not "production"; staging-configured builds cannot be promoted.`,
    );
  }
  if (evidence.verified !== true) {
    throw new PromotionRefusedError(`${context} is not marked verified.`);
  }
  const deploymentId = requireString(evidence, 'deploymentId', context);
  if (!/^dpl_[A-Za-z0-9]+$/u.test(deploymentId)) {
    throw new PromotionRefusedError(`${context} deploymentId "${deploymentId}" is not a dpl_ id.`);
  }
  const deploymentUrl = requireString(evidence, 'deploymentUrl', context);
  const sourceRevision = requireSha(evidence, 'sourceRevision', context);
  if (!isRecord(evidence.readiness)) {
    throw new PromotionRefusedError(`${context} lacks readiness proof.`);
  }
  const readinessRevision = requireString(evidence.readiness, 'revision', `${context}.readiness`);
  if (readinessRevision !== sourceRevision) {
    throw new PromotionRefusedError(
      `${context} readiness revision ${readinessRevision} does not match sourceRevision ${sourceRevision}.`,
    );
  }
  if (expectations.expectedRevision && expectations.expectedRevision !== sourceRevision) {
    throw new PromotionRefusedError(
      `expected revision ${expectations.expectedRevision} but evidence is for ${sourceRevision}.`,
    );
  }
  return {
    ...(evidence as unknown as VercelDeploymentEvidence),
    deploymentId,
    deploymentUrl,
    sourceRevision,
  };
}

export type PromotionEvidence = {
  readonly kind: 'vercel-promotion';
  readonly deploymentId: string;
  readonly deploymentUrl: string;
  readonly sourceRevision: string;
  readonly promotedAt: string;
  readonly deploymentEvidencePath: string;
};

export function promoteVercelDeployment(options: {
  readonly evidencePath: string;
  readonly promotionEvidencePath: string;
  readonly expectedRevision?: string;
  readonly runner?: CommandRunner;
  readonly rootDir?: string;
  readonly now?: () => Date;
  readonly providerCliPinsPath?: string;
}): PromotionEvidence {
  const evidence = assertPromotable(readJsonEvidence(options.evidencePath), {
    expectedRevision: options.expectedRevision,
  });
  const runner = options.runner ?? spawnCommandRunner;
  // The pinned Vercel CLI must be installed (deploy.yml) before promotion is attempted.
  assertProviderCli({
    cli: 'vercel',
    runner,
    cwd: options.rootDir,
    pinsPath: options.providerCliPinsPath,
  });
  // `vercel promote <id> --yes` assigns the production domains to an existing deployment
  // without rebuilding; nothing else changes.
  runOrThrow(runner, 'vercel', ['promote', evidence.deploymentId, '--yes'], {
    cwd: options.rootDir,
  });
  const promotion: PromotionEvidence = {
    kind: 'vercel-promotion',
    deploymentId: evidence.deploymentId,
    deploymentUrl: evidence.deploymentUrl,
    sourceRevision: evidence.sourceRevision,
    promotedAt: (options.now ?? (() => new Date()))().toISOString(),
    deploymentEvidencePath: options.evidencePath,
  };
  writeJsonEvidence(options.promotionEvidencePath, promotion);
  return promotion;
}

export function main(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): number {
  const { flags } = parseFlags(argv);
  const rootDir = flagString(flags, 'root') ?? process.cwd();
  const evidencePath =
    flagString(flags, 'evidence') ??
    path.join(rootDir, 'test-results', 'deploy', 'vercel-production.json');
  const promotion = promoteVercelDeployment({
    evidencePath,
    promotionEvidencePath:
      flagString(flags, 'promotion-evidence') ??
      path.join(rootDir, 'test-results', 'deploy', 'vercel-promotion.json'),
    expectedRevision: flagString(flags, 'revision') ?? env.NABATABLE_SOURCE_REVISION,
    rootDir,
  });
  process.stdout.write(`promoted ${promotion.deploymentId} at ${promotion.promotedAt}\n`);
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'vercel-promote.ts') {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
