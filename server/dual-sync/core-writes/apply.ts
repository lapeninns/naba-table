/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Post-write side-effect runner. Wrappers in `core-writes/{details,
 * hours,service-periods,business-context}.ts` call this with the
 * Nabatable canonical snapshot before and after the Core write so the
 * registry can detect every changed syncable field and:
 *
 *   1. mark `dual_sync_field_states.state = core_dirty` for the field
 *   2. open or refresh the matching `dual_sync_outbound_candidates` row
 *
 * Google snapshot freshness is *not* read here. Drift detection vs the
 * latest known Google value happens in `state/recompute.ts`, which is
 * called by the refresh service. Core writes only know that "Core moved",
 * so they overlay `core_dirty` on top of the existing state machine.
 */

import { hashCanonicalJson } from '../hashing';
import { upsertOutboundCandidate } from '../outbound/candidates';
import { buildRegistry, type DualSyncFieldConfig } from '../registry';
import { readFieldState } from '../state/read';
import { upsertFieldState } from '../state/write';
import { type DualSyncSectionKey } from '../types';

import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface ApplyCoreWriteSideEffectsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly before: DualSyncCanonicalSnapshot;
  readonly after: DualSyncCanonicalSnapshot;
  /** User who performed the write, for outbound-candidate audit. */
  readonly actorUserId?: string | null;
}

export interface ApplyCoreWriteSideEffectsOutput {
  readonly changedFieldKeys: ReadonlyArray<string>;
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
    case 'core_only':
      return null;
    default:
      return null;
  }
}

function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: DualSyncFieldConfig,
): unknown {
  const sectionValue = readSectionValue(snapshot, config.sectionKey);
  if (sectionValue === null || sectionValue === undefined) return null;

  if (config.kind === 'profile') {
    const profileKey = config.fieldKey.split('.')[1];
    if (!profileKey) return null;
    return (sectionValue as Record<string, unknown>)[profileKey] ?? null;
  }
  return sectionValue;
}

/**
 * Compare Nabatable canonical snapshots before and after a Core write and
 * apply the side-effects required by the dual-sync state machine.
 *
 * Pure invariants:
 *  - Core-only fields are skipped (registry marks them `unsupported`).
 *  - Fields whose canonical hash did not change are skipped.
 *  - The function is idempotent: re-running with identical (before, after)
 *    snapshots produces identical state rows.
 */
export async function applyCoreWriteSideEffects(
  input: ApplyCoreWriteSideEffectsInput,
): Promise<ApplyCoreWriteSideEffectsOutput> {
  const { client, restaurantId, before, after, actorUserId } = input;

  const registry = buildRegistry({
    coreSnapshot: after,
    gbpSnapshot: before, // doesn't matter for change detection; we only read core-side hashes
    includeCoreOnly: false,
  });

  const changed: string[] = [];

  for (const config of registry) {
    if (config.conflictPolicy === 'unsupported') continue;
    if (config.sectionKey === 'core_only') continue;

    const beforeRaw = valueForField(before, config);
    const afterRaw = valueForField(after, config);
    const beforeHash = hashCanonicalJson(config.canonicalizeCoreValue(beforeRaw));
    const afterHash = hashCanonicalJson(config.canonicalizeCoreValue(afterRaw));

    if (beforeHash === afterHash) continue;

    const previous = await readFieldState({ client, restaurantId, fieldKey: config.fieldKey });
    const lastInSyncHash = previous?.lastInSyncHash ?? null;
    const previouslyInSyncWithGoogle = lastInSyncHash !== null;

    // For exportable fields whose Google counterpart is known, queue an
    // outbound candidate so the operator sees a pending export. For
    // import-only fields (e.g. Maps URL) Core writes are local-only and
    // don't create candidates.
    const exportable = config.exportable;
    if (exportable) {
      await upsertOutboundCandidate({
        client,
        restaurantId,
        sectionKey: config.sectionKey as DualSyncSectionKey,
        fieldKey: config.fieldKey,
        proposedValue: config.normalizeCoreValue(afterRaw),
        proposedValueHash: afterHash,
        baselineGbpHash: previous?.gbpValueHash ?? null,
        source: 'core_write',
        createdByUserId: actorUserId ?? null,
      });
    }

    await upsertFieldState({
      client,
      restaurantId,
      sectionKey: config.sectionKey as DualSyncSectionKey,
      fieldKey: config.fieldKey,
      // pending_export when we know Google's value and Core moved away from it,
      // core_dirty otherwise (no Google baseline yet).
      state: previouslyInSyncWithGoogle && exportable ? 'pending_export' : 'core_dirty',
      coreValueHash: afterHash,
      lastCoreChangeAt: new Date().toISOString(),
    });

    changed.push(config.fieldKey);
  }

  return { changedFieldKeys: changed };
}
