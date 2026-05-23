import { assertDualSyncRestaurantNotPaused } from '../controls';
import { getDualSyncRuntimeFlags, type DualSyncRuntimeFlags } from '../flag';
import { refreshFromGoogleWithoutLock } from '../refresh/service';
import { buildRegistry, type DualSyncFieldConfig } from '../registry';
import { buildDecisionHash } from './orchestrator-domain';
import { ensureActiveFieldPolicyVersion } from '../registry/field-policy-versions';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';

import type { DualSyncRunPublishInput } from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncFieldPolicyVersion } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ReadSnapshot = (input: {
  readonly client: DbClient;
  readonly restaurantId: string;
}) => Promise<DualSyncCanonicalSnapshot>;

interface PreparePublishRuntimeContextInput {
  readonly client: DbClient;
  readonly input: DualSyncRunPublishInput;
  readonly refreshGoogleBeforePublish?: boolean;
  readonly readCoreSnapshot?: ReadSnapshot;
  readonly readGbpSnapshot?: ReadSnapshot;
}

interface PreparePublishRuntimeContextResult {
  readonly restaurantId: string;
  readonly readCoreSnapshot: ReadSnapshot;
  readonly readGbpSnapshot: ReadSnapshot;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly registry: ReadonlyArray<DualSyncFieldConfig>;
  readonly fieldPolicyVersion: DualSyncFieldPolicyVersion;
  readonly decisionHash: string;
  readonly runtimeFlags: DualSyncRuntimeFlags;
}

export async function preparePublishRuntimeContext(
  input: PreparePublishRuntimeContextInput,
): Promise<PreparePublishRuntimeContextResult> {
  const { client } = input;
  const { restaurantId } = input.input;
  const readCoreSnapshot = input.readCoreSnapshot ?? readNabatableSnapshot;
  const readGbpSnapshot = input.readGbpSnapshot ?? readGoogleSnapshot;

  await assertDualSyncRestaurantNotPaused({ client, restaurantId });

  if (input.refreshGoogleBeforePublish) {
    await refreshFromGoogleWithoutLock({
      client,
      restaurantId,
      runKind: 'preflight',
      skipPull: false,
    });
  }

  const [coreSnapshot, gbpSnapshot] = await Promise.all([
    readCoreSnapshot({ client, restaurantId }),
    readGbpSnapshot({ client, restaurantId }),
  ]);
  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const fieldPolicyVersion = await ensureActiveFieldPolicyVersion({
    client,
    registry,
    restaurantId,
    createdByUserId: input.input.actorUserId,
  });

  return {
    restaurantId,
    readCoreSnapshot,
    readGbpSnapshot,
    coreSnapshot,
    gbpSnapshot,
    registry,
    fieldPolicyVersion,
    decisionHash: buildDecisionHash(input.input, fieldPolicyVersion.policyHash),
    runtimeFlags: getDualSyncRuntimeFlags({ restaurantId }),
  };
}
