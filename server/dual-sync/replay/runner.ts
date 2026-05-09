/**
 * Deterministic replay helper for dual-sync fixtures.
 *
 * This is intentionally pure: it does not read or write Supabase and it
 * does not call Google. Tests can feed Core/Google snapshot pairs and
 * assert field-state transitions plus publish-plan output.
 */

import { hashCanonicalJson } from '../hashing';
import { buildPublishPlan } from '../publish/planner';
import { buildRegistry, type DualSyncFieldConfig } from '../registry';
import { computeFieldState } from '../state/compute';

import type { DualSyncPublishPlan, DualSyncRunPublishInput } from '../publish/types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncFieldState, DualSyncSectionKey } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface DualSyncReplayPreviousState {
  readonly fieldKey: string;
  readonly state: DualSyncFieldState;
  readonly lastInSyncHash?: string | null;
}

export interface DualSyncReplayScenario {
  readonly name: string;
  readonly restaurantId: string;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly previousStates?: ReadonlyArray<DualSyncReplayPreviousState>;
  readonly openOutboundFieldKeys?: ReadonlyArray<string>;
  readonly includeCoreOnly?: boolean;
  readonly publishInput?: Omit<DualSyncRunPublishInput, 'restaurantId'>;
}

export interface DualSyncReplayFieldState {
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly state: DualSyncFieldState;
  readonly coreHash: string | null;
  readonly gbpHash: string | null;
  readonly lastInSyncHash: string | null;
}

export interface DualSyncReplayResult {
  readonly name: string;
  readonly restaurantId: string;
  readonly fieldStates: ReadonlyArray<DualSyncReplayFieldState>;
  readonly publishPlan: DualSyncPublishPlan | null;
}

function readSectionValue(
  snapshot: DualSyncCanonicalSnapshot,
  sectionKey: DualSyncSectionKey | 'core_only',
): unknown {
  switch (sectionKey) {
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
    default:
      return null;
  }
}

function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: DualSyncFieldConfig,
  side: 'core' | 'gbp',
): unknown {
  const sectionValue = readSectionValue(snapshot, config.sectionKey);
  if (sectionValue === null || sectionValue === undefined) return null;
  if (config.kind === 'profile') {
    const profileKey = config.fieldKey.split('.')[1];
    if (!profileKey) return null;
    return (sectionValue as Record<string, unknown>)[profileKey] ?? null;
  }
  if (config.kind === 'core_only') {
    return side === 'core' ? sectionValue : null;
  }
  return sectionValue;
}

function computeReplayFieldStates(
  scenario: DualSyncReplayScenario,
): ReadonlyArray<DualSyncReplayFieldState> {
  const registry = buildRegistry({
    coreSnapshot: scenario.coreSnapshot,
    gbpSnapshot: scenario.gbpSnapshot,
    includeCoreOnly: scenario.includeCoreOnly ?? false,
  });
  const previousByKey = new Map((scenario.previousStates ?? []).map((row) => [row.fieldKey, row]));
  const openOutbound = new Set(scenario.openOutboundFieldKeys ?? []);

  return registry.map((config) => {
    const coreHash = hashCanonicalJson(
      config.canonicalizeCoreValue(valueForField(scenario.coreSnapshot, config, 'core')),
    );
    const gbpHash = hashCanonicalJson(
      config.canonicalizeGbpValue(valueForField(scenario.gbpSnapshot, config, 'gbp')),
    );
    const previous = previousByKey.get(config.fieldKey) ?? null;
    const state = computeFieldState({
      conflictPolicy: config.conflictPolicy,
      coreHash,
      gbpHash,
      lastInSyncHash: previous?.lastInSyncHash ?? null,
      hasOpenOutboundCandidate: openOutbound.has(config.fieldKey),
      previousState: previous?.state ?? null,
      ignored: previous?.state === 'ignored',
    });
    return {
      fieldKey: config.fieldKey,
      sectionKey: config.sectionKey,
      state,
      coreHash,
      gbpHash,
      lastInSyncHash: previous?.lastInSyncHash ?? null,
    };
  });
}

export async function runDualSyncReplayScenario(
  scenario: DualSyncReplayScenario,
): Promise<DualSyncReplayResult> {
  const fieldStates = computeReplayFieldStates(scenario);
  const publishPlan = scenario.publishInput
    ? await buildPublishPlan(
        {} as DbClient,
        {
          ...scenario.publishInput,
          restaurantId: scenario.restaurantId,
        },
        {
          readCoreSnapshot: async () => scenario.coreSnapshot,
          readGbpSnapshot: async () => scenario.gbpSnapshot,
        },
      )
    : null;

  return {
    name: scenario.name,
    restaurantId: scenario.restaurantId,
    fieldStates,
    publishPlan,
  };
}
