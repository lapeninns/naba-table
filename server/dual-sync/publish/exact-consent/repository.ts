import { randomUUID } from 'node:crypto';

import { logger } from '@/lib/logger';

import { hashCanonicalJson } from '../../hashing';
import {
  createSupabaseGoogleWriteTerminalNoticePersistence,
  materializeGoogleWriteTerminalNotice,
} from '../../notifications/terminal';

import type {
  ExactConsentPreview,
  ExactConsentRiskAcknowledgement,
  ExactConsentTerminalStatus,
} from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type GrantIssue = Database['public']['CompositeTypes']['gbp_write_grant_issue_v1'];
type IssueArgs = Database['public']['Functions']['issue_gbp_write_bundle_v1']['Args'];
type GrantRow = Database['public']['Tables']['gbp_write_grants_v1']['Row'];
type EnqueueResult = Database['public']['CompositeTypes']['gbp_write_bundle_enqueue_result_v1'];

type TerminalNoticeInput = {
  readonly restaurantId: string;
  readonly grantId: string;
  readonly eventId: string;
  readonly status: Extract<ExactConsentTerminalStatus, 'consumed' | 'failed' | 'outcome_unknown'>;
  readonly reasonCode: string;
  readonly terminalAt: string;
};

export type ExactConsentGrantBundle = {
  readonly bundleId: string;
  readonly grantIds: readonly string[];
  readonly bundleHash: string;
  readonly rpcArgs: IssueArgs;
};

export type ExactConsentGrantIdentity = {
  readonly restaurantId: string;
  readonly bundleId: string;
  readonly grantId: string;
  readonly executionId: string;
  readonly bundleOrder: number;
};

function requiredHash(value: unknown): string {
  return hashCanonicalJson(value) ?? hashCanonicalJson({ absent: true }) ?? '';
}

function orderedHashes(
  fieldKeys: readonly string[],
  values: Readonly<Record<string, string>>,
): string[] {
  return fieldKeys.map((fieldKey) => values[fieldKey] ?? requiredHash({ absent: true }));
}

export function buildExactConsentGrantBundle(input: {
  readonly preview: ExactConsentPreview;
  readonly actorUserId: string;
  readonly riskAcknowledgements: readonly ExactConsentRiskAcknowledgement[];
  readonly idFactory?: () => string;
}): ExactConsentGrantBundle {
  const idFactory = input.idFactory ?? randomUUID;
  const bundleId = idFactory();
  const risks = [...new Set(input.riskAcknowledgements)].sort();
  const partial = input.preview.groups.map((group, index) => {
    const fieldKeys = [...group.fieldKeys].sort();
    return {
      grant_id: idFactory(),
      group_id: group.groupId,
      direction: group.direction,
      field_keys: fieldKeys,
      write_group: group.writeGroup,
      google_method: group.method,
      google_resource: group.resource,
      update_masks: [...group.updateMasks].sort(),
      update_masks_hash: requiredHash([...group.updateMasks].sort()),
      before_hashes: orderedHashes(fieldKeys, group.beforeHashes.google),
      after_hashes: orderedHashes(fieldKeys, group.afterHashes.google),
      request_hash: group.requestHash,
      decision_hash: group.decisionHash,
      core_snapshot_hash: input.preview.snapshotPins.core,
      google_snapshot_hash: input.preview.snapshotPins.google,
      preview_fingerprint: input.preview.planFingerprint,
      risk_acknowledgements: risks,
      bundle_order: index + 1,
    };
  });
  const bundleHash = requiredHash(partial);
  const grants: GrantIssue[] = partial.map((grant) => ({
    ...grant,
    manifest_hash: requiredHash({
      ...grant,
      bundleId,
      bundleHash,
      listing: input.preview.listing,
      policyVersion: input.preview.policyVersion,
      rendererVersion: input.preview.rendererVersion,
      issuedAt: input.preview.issuedAt,
      expiresAt: input.preview.expiresAt,
    }),
  }));
  return {
    bundleId,
    grantIds: Object.freeze(grants.map((grant) => grant.grant_id)),
    bundleHash,
    rpcArgs: {
      p_restaurant_id: input.preview.listing.restaurantId,
      p_external_profile_row_id: input.preview.listing.externalProfileRowId,
      p_actor_user_id: input.actorUserId,
      p_external_account_id: input.preview.listing.accountId,
      p_external_profile_id: input.preview.listing.profileId,
      p_external_location_id: input.preview.listing.locationId,
      p_connection_generation: input.preview.listing.connectionGeneration,
      p_consent_epoch: input.preview.listing.consentEpoch,
      p_bundle_id: bundleId,
      p_bundle_hash: bundleHash,
      p_policy_version: input.preview.policyVersion,
      p_renderer_version: input.preview.rendererVersion,
      p_issued_at: input.preview.issuedAt,
      p_expires_at: input.preview.expiresAt,
      p_grants: grants,
    },
  };
}

async function requireData<T>(result: {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
}): Promise<T> {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error('Exact-consent repository returned no data.');
  return result.data;
}

export function createExactConsentGrantRepository(
  client: DbClient,
  options: {
    readonly materializeTerminalNotice?: (input: TerminalNoticeInput) => Promise<unknown>;
  } = {},
) {
  const materializeTerminalNotice =
    options.materializeTerminalNotice ??
    ((input: TerminalNoticeInput) =>
      materializeGoogleWriteTerminalNotice(
        input,
        createSupabaseGoogleWriteTerminalNoticePersistence(client),
      ));
  return {
    issue: async (args: IssueArgs): Promise<GrantRow[]> =>
      requireData(await client.rpc('issue_gbp_write_bundle_v1', args)),
    issueAndClaim: async (args: IssueArgs, executionId: string): Promise<GrantRow[]> =>
      requireData(
        await client.rpc('issue_and_claim_gbp_write_bundle_v1', {
          ...args,
          p_execution_id: executionId,
        }),
      ),
    issueAndEnqueue: async (args: IssueArgs, jobId: string): Promise<EnqueueResult> =>
      requireData(
        await client.rpc('issue_and_enqueue_gbp_write_bundle_v1', { ...args, p_job_id: jobId }),
      ),
    dispatch: async (identity: ExactConsentGrantIdentity): Promise<GrantRow> =>
      requireData(
        await client.rpc('dispatch_gbp_write_grant_v1', {
          p_restaurant_id: identity.restaurantId,
          p_bundle_id: identity.bundleId,
          p_grant_id: identity.grantId,
          p_execution_id: identity.executionId,
          p_bundle_order: identity.bundleOrder,
        }),
      ),
    finalize: async (
      identity: ExactConsentGrantIdentity,
      status: Extract<ExactConsentTerminalStatus, 'consumed' | 'failed' | 'outcome_unknown'>,
      reasonCode: string,
    ): Promise<GrantRow> => {
      const grant = await requireData(
        await client.rpc('finalize_gbp_write_grant_v1', {
          p_restaurant_id: identity.restaurantId,
          p_bundle_id: identity.bundleId,
          p_grant_id: identity.grantId,
          p_execution_id: identity.executionId,
          p_bundle_order: identity.bundleOrder,
          p_status: status,
          p_reason_code: reasonCode,
        }),
      );
      if (grant.terminal_at) {
        try {
          await materializeTerminalNotice({
            restaurantId: identity.restaurantId,
            grantId: identity.grantId,
            eventId: `gbp-write-terminal:${identity.grantId}`,
            status,
            reasonCode,
            terminalAt: grant.terminal_at,
          });
        } catch {
          logger.warn('Google write terminal notice materialization failed', {
            restaurantId: identity.restaurantId,
            grantId: identity.grantId,
          });
        }
      }
      return grant;
    },
    cancelBeforeDispatch: async (input: {
      readonly restaurantId: string;
      readonly bundleId: string;
      readonly executionId: string;
      readonly reasonCode: string;
    }): Promise<GrantRow[]> =>
      requireData(
        await client.rpc('cancel_gbp_claimed_bundle_before_dispatch_v1', {
          p_restaurant_id: input.restaurantId,
          p_bundle_id: input.bundleId,
          p_execution_id: input.executionId,
          p_reason_code: input.reasonCode,
        }),
      ),
  };
}
