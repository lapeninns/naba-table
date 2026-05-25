import {
  listProjectedFoodMenusIdentities,
  readLatestFoodMenusSnapshot,
} from './food-menus-storage';
import { mapProjectedFoodMenusIdentityRows } from './food-menus-sync-domain';

import type { GoogleFoodMenusProjectedIdentity } from './food-menus';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export async function resolvePreviousFoodMenusIdentities({
  client,
  restaurantId,
  projectionSnapshotId,
  previousIdentities,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly projectionSnapshotId?: string | null;
  readonly previousIdentities?: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
}): Promise<{
  readonly projectionSnapshotId: string | null;
  readonly identities: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
}> {
  if (previousIdentities) {
    return {
      projectionSnapshotId: projectionSnapshotId ?? null,
      identities: previousIdentities,
    };
  }

  const snapshotId =
    projectionSnapshotId ??
    (
      await readLatestFoodMenusSnapshot({
        client,
        restaurantId,
        snapshotKind: 'nabatable_projection',
      })
    )?.id ??
    null;

  if (!snapshotId) {
    return { projectionSnapshotId: null, identities: [] };
  }

  const rows = await listProjectedFoodMenusIdentities({
    client,
    restaurantId,
    snapshotId,
  });
  return {
    projectionSnapshotId: snapshotId,
    identities: mapProjectedFoodMenusIdentityRows(rows),
  };
}
