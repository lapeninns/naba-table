/**
 * Phase 3e of the unified dual-sync engine.
 *
 * Concrete `applyImportToCore` ports for the four business-context
 * sub-sections: categories, service areas, attributes, and service items.
 *
 * For each sub-section we:
 *  - parse the field key to recover the stable identifier (slug for
 *    display-name-keyed rows, `attributeKey` / `itemKey` otherwise),
 *  - read the full current core list (so we keep the database row ids and
 *    section fields the dual-sync canonical snapshot does not project),
 *  - splice in the canonical Google value (or remove the row when Google
 *    is missing the entry — that is the "delete" semantic for an import),
 *  - send the mutated array back through `updateRestaurantBusinessContext` with the revision
 *    that was read, so a Discovery save committed between the read and the write is never
 *    overwritten; on a stale write the list is re-read and the splice re-applied (bounded),
 *  - return the canonical hash of the new state so the orchestrator can
 *    bookkeep `in_sync_hash` for the field.
 */

import {
  BusinessContextStaleWriteError,
  getRestaurantBusinessContext,
  updateRestaurantBusinessContext,
} from '@/server/restaurants/businessContext';

import {
  BUSINESS_CONTEXT_IMPORT_PREFIX,
  buildAttributeImportUpdate,
  buildBusinessContextImportPortFailure,
  buildBusinessContextImportSuccess,
  buildCategoryImportUpdate,
  buildServiceAreaImportUpdate,
  buildServiceItemImportUpdate,
  findGoogleAttributeForImport,
  findGoogleCategoryForImport,
  findGoogleServiceAreaForImport,
  findGoogleServiceItemForImport,
  parseBusinessContextImportId,
  resolveBusinessContextImportFieldConfig,
} from './business-context-import-domain';
import { buildRegistry } from '../../registry';

import type { DualSyncOperationContext, DualSyncOperationResult } from '../types';
import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';

/** Attempts before a section import that keeps losing the revision race reports CORE_DRIFT. */
const MAX_IMPORT_ATTEMPTS = 3;

/**
 * Reads the section, splices in the Google value and writes it back under the revision it read.
 * A stale write means someone saved the section in between: re-read and re-apply onto their
 * list, so their rows survive. The RPC holds the restaurant lock for the compare-and-write.
 */
async function writeSectionImport(
  ctx: DualSyncOperationContext,
  buildInput: (snapshot: RestaurantBusinessContextSnapshot) => UpdateRestaurantBusinessContextInput,
): Promise<DualSyncOperationResult | null> {
  for (let attempt = 1; attempt <= MAX_IMPORT_ATTEMPTS; attempt += 1) {
    const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
    try {
      await updateRestaurantBusinessContext(
        ctx.restaurantId,
        buildInput(snapshot),
        ctx.client,
        {
          changeOrigin: 'import',
          changedByUserId: ctx.actorUserId ?? null,
          changedVia: 'dual-sync.publish',
          publishJobId: ctx.publishJobId,
        },
        { expectedRevision: snapshot.revision ?? null },
      );
      return null;
    } catch (error) {
      if (!(error instanceof BusinessContextStaleWriteError)) throw error;
    }
  }
  return {
    status: 'failed',
    failure: {
      code: 'CORE_DRIFT',
      message: 'Business context kept changing during the import. Try again.',
      retryable: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function applyBusinessContextCategoryImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const slug = parseBusinessContextImportId(
    ctx.decision.fieldKey,
    BUSINESS_CONTEXT_IMPORT_PREFIX.category,
  );
  if (!slug) {
    return buildBusinessContextImportPortFailure(
      `Categories port does not handle ${ctx.decision.fieldKey}.`,
    );
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveBusinessContextImportFieldConfig(registry, ctx.decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  const googleEntry = findGoogleCategoryForImport(ctx.gbpSnapshot, slug);
  const drift = await writeSectionImport(ctx, (snapshot) => ({
    categories: buildCategoryImportUpdate(snapshot.core.categories, slug, googleEntry),
  }));
  if (drift) return drift;

  return buildBusinessContextImportSuccess(configResult.config, googleEntry);
}

// ---------------------------------------------------------------------------
// Service areas
// ---------------------------------------------------------------------------

export async function applyBusinessContextServiceAreaImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const slug = parseBusinessContextImportId(
    ctx.decision.fieldKey,
    BUSINESS_CONTEXT_IMPORT_PREFIX.serviceArea,
  );
  if (!slug) {
    return buildBusinessContextImportPortFailure(
      `Service-areas port does not handle ${ctx.decision.fieldKey}.`,
    );
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveBusinessContextImportFieldConfig(registry, ctx.decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  const googleEntry = findGoogleServiceAreaForImport(ctx.gbpSnapshot, slug);
  const drift = await writeSectionImport(ctx, (snapshot) => ({
    serviceAreas: buildServiceAreaImportUpdate(snapshot.core.serviceAreas, slug, googleEntry),
  }));
  if (drift) return drift;

  return buildBusinessContextImportSuccess(configResult.config, googleEntry);
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

export async function applyBusinessContextAttributeImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const attributeKey = parseBusinessContextImportId(
    ctx.decision.fieldKey,
    BUSINESS_CONTEXT_IMPORT_PREFIX.attribute,
  );
  if (!attributeKey) {
    return buildBusinessContextImportPortFailure(
      `Attributes port does not handle ${ctx.decision.fieldKey}.`,
    );
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveBusinessContextImportFieldConfig(registry, ctx.decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  const googleEntry = findGoogleAttributeForImport(ctx.gbpSnapshot, attributeKey);
  const drift = await writeSectionImport(ctx, (snapshot) => ({
    attributes: buildAttributeImportUpdate(snapshot.core.attributes, attributeKey, googleEntry),
  }));
  if (drift) return drift;

  return buildBusinessContextImportSuccess(configResult.config, googleEntry);
}

// ---------------------------------------------------------------------------
// Service items
// ---------------------------------------------------------------------------

export async function applyBusinessContextServiceItemImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const itemKey = parseBusinessContextImportId(
    ctx.decision.fieldKey,
    BUSINESS_CONTEXT_IMPORT_PREFIX.serviceItem,
  );
  if (!itemKey) {
    return buildBusinessContextImportPortFailure(
      `Service-items port does not handle ${ctx.decision.fieldKey}.`,
    );
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveBusinessContextImportFieldConfig(registry, ctx.decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  const googleEntry = findGoogleServiceItemForImport(ctx.gbpSnapshot, itemKey);
  const drift = await writeSectionImport(ctx, (snapshot) => ({
    serviceItems: buildServiceItemImportUpdate(snapshot.core.serviceItems, itemKey, googleEntry),
  }));
  if (drift) return drift;

  return buildBusinessContextImportSuccess(configResult.config, googleEntry);
}
