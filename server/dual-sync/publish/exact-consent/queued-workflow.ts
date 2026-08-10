import { randomUUID } from 'node:crypto';

import { hashCanonicalJson } from '../../hashing';
import { buildRegistry, findFieldConfig } from '../../registry';
import { valueForField } from '../orchestrator-domain';
import { readPublishPlannerRuntime } from '../planner-runtime';
import { buildSupportedExactConsentPlan } from './adapter';
import {
  readSupportedExactConsentEligibility,
  readSupportedGoogleUpdates,
  withExactConsentListingLock,
} from './adapter-eligibility';
import { executeClaimedExactConsent } from './claimed-execution';
import { assertExactConsentGoogleUpdatesSafe } from './confirm';
import { assertExactConsentEligibility } from './eligibility';
import { claimQueuedExactConsentPermits } from './permits';
import { assertDatabaseQueueEnvelopeMatchesPreview } from './queued-recheck';

import type { DatabaseGoogleWriteQueueEnvelope } from './queue';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export async function executeDatabaseQueuedExactConsent(input: {
  readonly client: DbClient;
  readonly envelope: DatabaseGoogleWriteQueueEnvelope;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}): Promise<void> {
  const restaurantId = input.envelope.restaurant_id;
  await withExactConsentListingLock(input.client, restaurantId, async () => {
    const runtime = await readPublishPlannerRuntime({ client: input.client, restaurantId });
    const registry = buildRegistry({
      coreSnapshot: runtime.coreSnapshot,
      gbpSnapshot: runtime.gbpSnapshot,
      includeCoreOnly: false,
    });
    const decisions = input.envelope.groups.flatMap((group) =>
      group.field_keys.map((fieldKey) => {
        const config = findFieldConfig(registry, fieldKey);
        if (!config || config.sectionKey === 'core_only') {
          throw new Error('Queued exact write field is no longer supported.');
        }
        return {
          fieldKey,
          sectionKey: config.sectionKey,
          action: 'export_to_google' as const,
          pinnedCoreHash: hashCanonicalJson(
            config.canonicalizeCoreValue(valueForField(runtime.coreSnapshot, config, 'core')),
          ),
          pinnedGbpHash: hashCanonicalJson(
            config.canonicalizeGbpValue(valueForField(runtime.gbpSnapshot, config, 'gbp')),
          ),
        };
      }),
    );
    const issuedAt = new Date(new Date(input.envelope.expires_at).getTime() - 15 * 60 * 1_000);
    const fresh = await buildSupportedExactConsentPlan({
      client: input.client,
      publish: {
        restaurantId,
        decisions,
        actorUserId: null,
        pinnedCoreSnapshotHash: input.envelope.groups[0]?.core_snapshot_hash ?? null,
        pinnedGbpSnapshotHash: input.envelope.groups[0]?.google_snapshot_hash ?? null,
      },
      clock: () => issuedAt,
    });
    assertDatabaseQueueEnvelopeMatchesPreview({
      envelope: input.envelope,
      preview: fresh.preview,
      clock: input.clock,
    });
    assertExactConsentEligibility({
      preview: fresh.preview,
      ...(await readSupportedExactConsentEligibility({
        client: input.client,
        preview: fresh.preview,
      })),
    });
    assertExactConsentGoogleUpdatesSafe(
      fresh.preview,
      await readSupportedGoogleUpdates({
        accessToken: fresh.linked.accessToken,
        preview: fresh.preview,
      }),
    );
    const executionId = (input.idFactory ?? randomUUID)();
    const permits = await claimQueuedExactConsentPermits({
      client: input.client,
      envelope: input.envelope,
      executionId,
    });
    await executeClaimedExactConsent({
      client: input.client,
      restaurantId,
      bundleId: input.envelope.bundle_id,
      executionId,
      grantIds: input.envelope.grant_ids,
      execute: () => fresh.executeImmediate(permits),
    });
  });
}
