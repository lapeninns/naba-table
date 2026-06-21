import { getDualSyncRestaurantControl } from '../controls';
import { hashCanonicalJson } from '../hashing';
import { buildRegistry } from '../registry';
import { getDualSyncRuntimeControls } from '../runtime-controls';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';

import type { DualSyncRuntimeControls } from '../runtime-controls';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncRestaurantControl } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface BuildPublishPlanOptions {
  readonly readCoreSnapshot?: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
  readonly readGbpSnapshot?: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
}

export interface PublishPlannerRuntime {
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly coreSnapshotHash: string;
  readonly gbpSnapshotHash: string;
  readonly registry: ReturnType<typeof buildRegistry>;
  readonly runtimeControls: DualSyncRuntimeControls;
  readonly control: DualSyncRestaurantControl;
}

export async function readPublishPlannerRuntime(input: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly options?: BuildPublishPlanOptions;
}): Promise<PublishPlannerRuntime> {
  const readCore = input.options?.readCoreSnapshot ?? readNabatableSnapshot;
  const readGbp = input.options?.readGbpSnapshot ?? readGoogleSnapshot;
  const [coreSnapshot, gbpSnapshot] = await Promise.all([
    readCore({ client: input.client, restaurantId: input.restaurantId }),
    readGbp({ client: input.client, restaurantId: input.restaurantId }),
  ]);
  const coreSnapshotHash = hashCanonicalJson(coreSnapshot) ?? '';
  const gbpSnapshotHash = hashCanonicalJson(gbpSnapshot) ?? '';
  const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
  const runtimeControls = getDualSyncRuntimeControls({ restaurantId: input.restaurantId });
  const control = await getDualSyncRestaurantControl({
    client: input.client,
    restaurantId: input.restaurantId,
  });

  return {
    coreSnapshot,
    gbpSnapshot,
    coreSnapshotHash,
    gbpSnapshotHash,
    registry,
    runtimeControls,
    control,
  };
}
