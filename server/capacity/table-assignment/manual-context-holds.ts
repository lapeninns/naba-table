import type { DbClient, ManualAssignmentContextHold } from './types';
import type { TableHold } from '@/server/capacity/holds';

export type ManualHoldCreatorProfile = {
  id: string;
  name: string | null;
  email: string | null;
};

export function getManualHoldCreatorIds(holds: TableHold[]): string[] {
  return Array.from(
    new Set(holds.map((hold) => hold.createdBy).filter((value): value is string => Boolean(value))),
  );
}

export function attachManualHoldCreatorProfiles({
  creators,
  holds,
}: {
  creators: ManualHoldCreatorProfile[];
  holds: TableHold[];
}): ManualAssignmentContextHold[] {
  const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));

  return holds.map((hold) => {
    const creator = hold.createdBy ? creatorsById.get(hold.createdBy) : null;
    return {
      ...hold,
      createdByName: creator?.name ?? null,
      createdByEmail: creator?.email ?? null,
    };
  });
}

export async function loadManualHoldCreatorProfiles({
  client,
  holds,
}: {
  client: DbClient;
  holds: TableHold[];
}): Promise<ManualHoldCreatorProfile[]> {
  const creatorIds = getManualHoldCreatorIds(holds);
  if (creatorIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, name, email')
    .in('id', creatorIds);

  if (error || !data) {
    return [];
  }

  return data as ManualHoldCreatorProfile[];
}

export async function hydrateManualAssignmentContextHolds({
  client,
  holds,
}: {
  client: DbClient;
  holds: TableHold[];
}): Promise<ManualAssignmentContextHold[]> {
  if (holds.length === 0) {
    return [];
  }

  const creators = await loadManualHoldCreatorProfiles({ client, holds });
  return attachManualHoldCreatorProfiles({ creators, holds });
}
