import { z } from 'zod';

import { getDualSyncDbClient, type DualSyncSnapshotRunRow } from '../db';
import { hashCanonicalJson } from '../hashing';
import {
  listOpenOutboundCandidates,
  resolveOutboundCandidate,
  upsertOutboundCandidate,
} from '../outbound/candidates';
import { buildRegistry } from '../registry';
import { expandOutboxFieldKeys } from './mapping';
import { readNabatableSnapshot } from '../snapshots/nabatable';
import { readFieldState } from '../state/read';
import { recomputeAllStates } from '../state/recompute';

import type { DualSyncFieldConfig } from '../registry';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const nullableString = z.string().nullable();
const storefrontAddressSchema = z.object({
  addressLines: z.array(z.string()),
  locality: nullableString,
  administrativeArea: nullableString,
  postalCode: nullableString,
  regionCode: nullableString,
  languageCode: nullableString,
  sublocality: nullableString,
  organization: nullableString,
  recipients: z.array(z.string()),
});
const canonicalSnapshotSchema = z.object({
  profile: z.object({
    name: nullableString,
    businessDescription: nullableString,
    contactPhone: nullableString,
    address: nullableString,
    storefrontAddress: storefrontAddressSchema.nullable(),
    googleMapUrl: nullableString,
    googleReviewUrl: nullableString,
  }),
  operatingHours: z.object({
    weekly: z.array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        opensAt: nullableString,
        closesAt: nullableString,
        isClosed: z.boolean(),
      }),
    ),
  }),
  servicePeriods: z.object({
    periods: z.array(
      z.object({
        stableKey: z.string(),
        name: z.string(),
        dayOfWeek: z.number().int().min(0).max(6).nullable(),
        startTime: z.string(),
        endTime: z.string(),
        bookingOption: z.string(),
      }),
    ),
  }),
  businessContext: z.object({
    categories: z.array(
      z.object({
        displayName: z.string(),
        categoryCode: nullableString,
        moreHoursTypes: z.array(
          z.object({
            hoursTypeId: nullableString,
            displayName: nullableString,
            localizedDisplayName: nullableString,
          }),
        ),
        isPrimary: z.boolean(),
      }),
    ),
    serviceAreas: z.array(
      z.object({
        displayName: z.string(),
        areaType: z.string(),
        regionCode: nullableString,
        placeData: z.record(z.string(), z.unknown()).nullable(),
      }),
    ),
    attributes: z.array(
      z.object({
        attributeKey: z.string(),
        attributeName: nullableString,
        attributeId: nullableString,
        valueType: z.string(),
        boolValue: z.boolean().nullable(),
        textValue: nullableString,
        uriValue: nullableString,
        uriValues: z.array(z.string()),
        enumValues: z.array(z.string()),
        unsetEnumValues: z.array(z.string()),
      }),
    ),
    serviceItems: z.array(
      z.object({
        itemKey: z.string(),
        itemType: nullableString,
        displayName: nullableString,
        description: nullableString,
        payload: z.record(z.string(), z.unknown()).nullable(),
      }),
    ),
  }),
  foodMenus: z
    .object({
      items: z.array(
        z.object({
          stableKey: z.string(),
          itemName: z.string(),
          sectionLabel: z.string(),
          description: nullableString,
          basePrice: z.number().nullable(),
          currency: nullableString,
          dietaryTags: z.array(z.string()),
          allergensContains: z.array(z.string()),
          googlePath: nullableString,
        }),
      ),
    })
    .optional(),
});

const EMPTY_GBP_SNAPSHOT: DualSyncCanonicalSnapshot = {
  profile: {
    name: null,
    businessDescription: null,
    contactPhone: null,
    address: null,
    storefrontAddress: null,
    googleMapUrl: null,
    googleReviewUrl: null,
  },
  operatingHours: { weekly: [] },
  servicePeriods: { periods: [] },
  businessContext: { categories: [], serviceAreas: [], attributes: [], serviceItems: [] },
  foodMenus: { items: [] },
};

function sectionValue(snapshot: DualSyncCanonicalSnapshot, config: DualSyncFieldConfig): unknown {
  switch (config.sectionKey) {
    case 'profile':
      return snapshot.profile;
    case 'operatingHours':
      return snapshot.operatingHours;
    case 'servicePeriods':
      return snapshot.servicePeriods;
    case 'businessContext.categories':
      return snapshot.businessContext.categories;
    case 'businessContext.serviceAreas':
      return snapshot.businessContext.serviceAreas;
    case 'businessContext.attributes':
      return snapshot.businessContext.attributes;
    case 'businessContext.serviceItems':
      return snapshot.businessContext.serviceItems;
    case 'foodMenus':
      return snapshot.foodMenus ?? { items: [] };
    case 'core_only':
      return null;
  }
}

function fieldValue(snapshot: DualSyncCanonicalSnapshot, config: DualSyncFieldConfig): unknown {
  const section = sectionValue(snapshot, config);
  if (config.kind !== 'profile' || typeof section !== 'object' || section === null) return section;
  const key = config.fieldKey.split('.')[1];
  return key === undefined ? null : Reflect.get(section, key);
}

async function readStoredGbpSnapshot(
  client: DbClient,
  restaurantId: string,
): Promise<DualSyncCanonicalSnapshot> {
  const { data, error } = await getDualSyncDbClient(client)
    .from('dual_sync_snapshot_runs')
    .select('canonical_snapshot')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'google_business_profile')
    .eq('status', 'succeeded')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<Pick<DualSyncSnapshotRunRow, 'canonical_snapshot'>>();
  if (error) throw error;
  if (data?.canonical_snapshot === null || data?.canonical_snapshot === undefined) {
    return EMPTY_GBP_SNAPSHOT;
  }
  return canonicalSnapshotSchema.parse(data.canonical_snapshot);
}

export async function discoverCoreOutboxCandidates(input: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly fieldKeys: readonly string[];
}): Promise<readonly string[]> {
  const [coreSnapshot, gbpSnapshot] = await Promise.all([
    readNabatableSnapshot({ client: input.client, restaurantId: input.restaurantId }),
    readStoredGbpSnapshot(input.client, input.restaurantId),
  ]);
  const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
  const selected = expandOutboxFieldKeys(
    input.fieldKeys,
    registry.map((config) => config.fieldKey),
  );
  const selectedSet = new Set(selected);
  const openCandidates = await listOpenOutboundCandidates({
    client: input.client,
    restaurantId: input.restaurantId,
  });
  const openByField = new Map(openCandidates.map((candidate) => [candidate.fieldKey, candidate]));

  for (const config of registry) {
    if (!selectedSet.has(config.fieldKey) || config.sectionKey === 'core_only') {
      continue;
    }
    const coreValue = fieldValue(coreSnapshot, config);
    const coreHash = hashCanonicalJson(config.canonicalizeCoreValue(coreValue));
    const gbpValue = fieldValue(gbpSnapshot, config);
    const gbpHash = hashCanonicalJson(config.canonicalizeGbpValue(gbpValue));
    if (!config.exportable || coreHash === gbpHash) {
      const existing = openByField.get(config.fieldKey);
      if (existing !== undefined) {
        await resolveOutboundCandidate({
          client: input.client,
          id: existing.id,
          nextStatus: 'cancelled',
        });
      }
      continue;
    }
    const state = await readFieldState({
      client: input.client,
      restaurantId: input.restaurantId,
      fieldKey: config.fieldKey,
    });
    await upsertOutboundCandidate({
      client: input.client,
      restaurantId: input.restaurantId,
      sectionKey: config.sectionKey,
      fieldKey: config.fieldKey,
      proposedValue: config.normalizeCoreValue(coreValue),
      proposedValueHash: coreHash,
      baselineGbpHash: state?.gbpValueHash ?? null,
      source: 'core_write',
    });
  }

  await recomputeAllStates({
    client: input.client,
    restaurantId: input.restaurantId,
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  return selected;
}
