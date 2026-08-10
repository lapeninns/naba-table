import { randomUUID } from 'node:crypto';

import { ExactConsentUnsupportedPlanError } from './adapter';
import { executeClaimedExactConsent } from './claimed-execution';
import { confirmExactConsentPreview } from './confirm';
import { assertExactConsentEligibility } from './eligibility';
import { issueAndClaimExactConsentPermits } from './permits';
import { buildExactConsentGrantBundle, createExactConsentGrantRepository } from './repository';
import { parseExactConsentPreview } from './schema';
import { ExactConsentError, ExactConsentExecutionError } from './types';

import type {
  ExactConsentGoogleUpdates,
  ExactConsentPreview,
  ExactConsentRiskAcknowledgement,
} from './types';
import type { GoogleWritePermit } from '@/server/google-business-profile/writePermit';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type Eligibility = Omit<Parameters<typeof assertExactConsentEligibility>[0], 'preview'>;

export type FreshExactConsentPlan = {
  readonly preview: ExactConsentPreview;
  readonly executeImmediate: (permits: readonly GoogleWritePermit[]) => Promise<readonly unknown[]>;
};

export type ExactConsentApprovalWindow = {
  readonly issuedAt: string;
  readonly expiresAt: string;
};

export type ConfirmExactConsentWorkflowResult =
  | {
      readonly mode: 'queued';
      readonly bundleId: string;
      readonly grantIds: readonly string[];
      readonly jobId: string;
      readonly status: string;
    }
  | {
      readonly mode: 'immediate';
      readonly bundleId: string;
      readonly grantIds: readonly string[];
      readonly outcomes: readonly unknown[];
    };

export async function confirmExactConsentAndIssue(input: {
  readonly client: DbClient;
  readonly submittedPreview: unknown;
  readonly acknowledged: boolean;
  readonly riskAcknowledgements: readonly ExactConsentRiskAcknowledgement[];
  readonly actorUserId: string;
  readonly mode: 'immediate' | 'queued';
  readonly withListingLock: <T>(work: () => Promise<T>) => Promise<T>;
  readonly rebuild: (approvalWindow: ExactConsentApprovalWindow) => Promise<FreshExactConsentPlan>;
  readonly readEligibility: () => Promise<Eligibility>;
  readonly readGoogleUpdates: () => Promise<ExactConsentGoogleUpdates>;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}): Promise<ConfirmExactConsentWorkflowResult> {
  const submitted = parseExactConsentPreview(input.submittedPreview);
  return input.withListingLock(async () => {
    let fresh: FreshExactConsentPlan;
    try {
      fresh = await input.rebuild({
        issuedAt: submitted.issuedAt,
        expiresAt: submitted.expiresAt,
      });
    } catch (failure) {
      if (
        failure instanceof ExactConsentError ||
        failure instanceof ExactConsentUnsupportedPlanError
      ) {
        throw failure;
      }
      throw new ExactConsentExecutionError('preflight');
    }
    let eligibility: Eligibility;
    let googleUpdates: ExactConsentGoogleUpdates;
    try {
      [eligibility, googleUpdates] = await Promise.all([
        input.readEligibility(),
        input.readGoogleUpdates(),
      ]);
    } catch {
      throw new ExactConsentExecutionError('preflight');
    }
    assertExactConsentEligibility({ preview: fresh.preview, ...eligibility });
    confirmExactConsentPreview({
      submitted,
      rebuilt: fresh.preview,
      acknowledged: input.acknowledged,
      riskAcknowledgements: input.riskAcknowledgements,
      googleUpdates,
      clock: input.clock,
    });
    const idFactory = input.idFactory ?? randomUUID;
    const bundle = buildExactConsentGrantBundle({
      preview: fresh.preview,
      actorUserId: input.actorUserId,
      riskAcknowledgements: input.riskAcknowledgements,
      idFactory,
    });
    if (input.mode === 'queued') {
      const jobId = idFactory();
      const queued = await createExactConsentGrantRepository(input.client)
        .issueAndEnqueue(bundle.rpcArgs, jobId)
        .catch(() => {
          throw new ExactConsentExecutionError('issuance');
        });
      return {
        mode: 'queued',
        bundleId: bundle.bundleId,
        grantIds: bundle.grantIds,
        jobId: queued.job_id,
        status: queued.job_status,
      };
    }
    const executionId = idFactory();
    const permits = await issueAndClaimExactConsentPermits({
      client: input.client,
      bundle,
      executionId,
    }).catch(() => {
      throw new ExactConsentExecutionError('issuance');
    });
    return {
      mode: 'immediate',
      bundleId: bundle.bundleId,
      grantIds: bundle.grantIds,
      outcomes: await executeClaimedExactConsent({
        client: input.client,
        restaurantId: bundle.rpcArgs.p_restaurant_id,
        bundleId: bundle.bundleId,
        executionId,
        grantIds: bundle.grantIds,
        execute: () => fresh.executeImmediate(permits),
      }),
    };
  });
}
