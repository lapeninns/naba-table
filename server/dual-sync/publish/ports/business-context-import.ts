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
 *  - send the mutated array back through `updateRestaurantBusinessContext`,
 *  - return the canonical hash of the new state so the orchestrator can
 *    bookkeep `in_sync_hash` for the field.
 */

import {
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
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const updated = buildCategoryImportUpdate(snapshot.core.categories, slug, googleEntry);

  await updateRestaurantBusinessContext(ctx.restaurantId, { categories: updated }, ctx.client, {
    changeOrigin: 'import',
    changedByUserId: ctx.actorUserId ?? null,
    changedVia: 'dual-sync.publish',
    publishJobId: ctx.publishJobId,
  });

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
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const updated = buildServiceAreaImportUpdate(snapshot.core.serviceAreas, slug, googleEntry);

  await updateRestaurantBusinessContext(ctx.restaurantId, { serviceAreas: updated }, ctx.client, {
    changeOrigin: 'import',
    changedByUserId: ctx.actorUserId ?? null,
    changedVia: 'dual-sync.publish',
    publishJobId: ctx.publishJobId,
  });

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
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const updated = buildAttributeImportUpdate(snapshot.core.attributes, attributeKey, googleEntry);

  await updateRestaurantBusinessContext(ctx.restaurantId, { attributes: updated }, ctx.client, {
    changeOrigin: 'import',
    changedByUserId: ctx.actorUserId ?? null,
    changedVia: 'dual-sync.publish',
    publishJobId: ctx.publishJobId,
  });

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
  const snapshot = await getRestaurantBusinessContext(ctx.restaurantId, ctx.client);
  const updated = buildServiceItemImportUpdate(snapshot.core.serviceItems, itemKey, googleEntry);

  await updateRestaurantBusinessContext(ctx.restaurantId, { serviceItems: updated }, ctx.client, {
    changeOrigin: 'import',
    changedByUserId: ctx.actorUserId ?? null,
    changedVia: 'dual-sync.publish',
    publishJobId: ctx.publishJobId,
  });

  return buildBusinessContextImportSuccess(configResult.config, googleEntry);
}
