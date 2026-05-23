/**
 * Phase 3f of the unified dual-sync engine.
 *
 * Concrete `applyExportToGoogle` ports for the four business-context
 * sub-sections (categories, service areas, attributes, service items).
 *
 * Each port:
 *  - resolves the Core canonical row by stable identifier,
 *  - merges that row into the existing Google list (so unselected rows
 *    aren't deleted by the patch — Google semantics for these masks
 *    replace the entire list, not a single entry),
 *  - calls `patchRestaurantGoogleBusinessProfileLocationFields` with the
 *    correct update mask.
 *
 * Multi-decision batches across the same sub-section are not yet
 * coalesced; each port reads its merged list from the snapshots taken at
 * job start, so concurrent decisions on the same sub-section will not
 * see each other's intermediate state. That mirrors V2 export semantics
 * for the rollout window and is documented in the orchestrator.
 */

import { patchRestaurantGoogleBusinessProfileLocationFields } from '@/server/google-business-profile/service';

import {
  BUSINESS_CONTEXT_EXPORT_PREFIX,
  buildBusinessContextExportSuccess,
  markBusinessContextBatchPatchFailure,
  planBusinessContextAttributeBatch,
  planBusinessContextListMergeBatch,
  planBusinessContextSingleAttributeExport,
  planBusinessContextSingleListExport,
  resolveBusinessContextExportFieldConfig,
} from './business-context-export-domain';
import {
  buildGoogleAttribute,
  buildGoogleCategoriesPatch,
  buildGoogleServiceAreaPatch,
  buildGoogleServiceItemsPatch,
  normalizeAttributeName,
} from './google-patch-builders';
import { buildRegistry } from '../../registry';
import { slugifyDisplay } from '../../registry/normalizers';

import type { BusinessContextListMergeAdapter } from './business-context-export-domain';
import type {
  DualSyncCategoryValue,
  DualSyncServiceAreaValue,
  DualSyncServiceItemValue,
} from '../../snapshots/types';
import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function applyBusinessContextCategoryExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const plan = planBusinessContextSingleListExport<DualSyncCategoryValue>(
    {
      fieldKey: ctx.decision.fieldKey,
      registry,
      coreSnapshot: ctx.coreSnapshot,
      gbpSnapshot: ctx.gbpSnapshot,
    },
    {
      fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
      identify: (entry) => slugifyDisplay(entry.displayName),
      readCoreList: (snapshot) => snapshot.businessContext?.categories ?? [],
      readGoogleList: (snapshot) => snapshot.businessContext?.categories ?? [],
      unsupportedMessage: (fieldKey) => `Categories export port does not handle ${fieldKey}.`,
      missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
    },
  );
  if (plan.status === 'failed') return plan.result;

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    locationPatch: { categories: buildGoogleCategoriesPatch(plan.merged) },
    updateMask: ['categories'],
    client: ctx.client,
  });

  return buildBusinessContextExportSuccess(plan.config, plan.coreEntry);
}

// ---------------------------------------------------------------------------
// Service areas
// ---------------------------------------------------------------------------

export async function applyBusinessContextServiceAreaExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const plan = planBusinessContextSingleListExport<DualSyncServiceAreaValue>(
    {
      fieldKey: ctx.decision.fieldKey,
      registry,
      coreSnapshot: ctx.coreSnapshot,
      gbpSnapshot: ctx.gbpSnapshot,
    },
    {
      fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.serviceArea,
      identify: (entry) => slugifyDisplay(entry.displayName),
      readCoreList: (snapshot) => snapshot.businessContext?.serviceAreas ?? [],
      readGoogleList: (snapshot) => snapshot.businessContext?.serviceAreas ?? [],
      unsupportedMessage: (fieldKey) => `Service-areas export port does not handle ${fieldKey}.`,
      missingMessage: (id) => `Core snapshot is missing service area ${id}; cannot export.`,
    },
  );
  if (plan.status === 'failed') return plan.result;

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    locationPatch: { serviceArea: buildGoogleServiceAreaPatch(plan.merged) },
    updateMask: ['serviceArea'],
    client: ctx.client,
  });

  return buildBusinessContextExportSuccess(plan.config, plan.coreEntry);
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

export async function applyBusinessContextAttributeExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const plan = planBusinessContextSingleAttributeExport({
    fieldKey: ctx.decision.fieldKey,
    registry,
    coreSnapshot: ctx.coreSnapshot,
  });
  if (plan.status === 'failed') return plan.result;

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    attributesPatch: {
      attributes: [buildGoogleAttribute(plan.coreEntry)],
      attributeMask: [normalizeAttributeName(plan.coreEntry)],
    },
    client: ctx.client,
  });

  return buildBusinessContextExportSuccess(plan.config, plan.coreEntry);
}

// ---------------------------------------------------------------------------
// Service items
// ---------------------------------------------------------------------------

export async function applyBusinessContextServiceItemExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const plan = planBusinessContextSingleListExport<DualSyncServiceItemValue>(
    {
      fieldKey: ctx.decision.fieldKey,
      registry,
      coreSnapshot: ctx.coreSnapshot,
      gbpSnapshot: ctx.gbpSnapshot,
    },
    {
      fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.serviceItem,
      identify: (entry) => entry.itemKey,
      readCoreList: (snapshot) => snapshot.businessContext?.serviceItems ?? [],
      readGoogleList: (snapshot) => snapshot.businessContext?.serviceItems ?? [],
      unsupportedMessage: (fieldKey) => `Service-items export port does not handle ${fieldKey}.`,
      missingMessage: (id) => `Core snapshot is missing service item ${id}; cannot export.`,
    },
  );
  if (plan.status === 'failed') return plan.result;

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    locationPatch: { serviceItems: buildGoogleServiceItemsPatch(plan.merged) },
    updateMask: ['serviceItems'],
    client: ctx.client,
  });

  return buildBusinessContextExportSuccess(plan.config, plan.coreEntry);
}

// ---------------------------------------------------------------------------
// Section-level batch ports
// ---------------------------------------------------------------------------

/**
 * Generic batch helper for the list-replacement flavours of
 * business-context (categories / service areas / service items). Each
 * decision targets one entry by `slug`/`itemKey`. Multiple decisions
 * collapse into one merged-list patch, replacing the on-Google list with:
 *   `(google entries not matching any decision) + (core entries for each decision)`.
 *
 * Decisions whose Core entry is missing fail with `PORT_FAILURE` and do
 * NOT enter the merged list; the patch still runs for the remaining
 * decisions. If no decisions are exportable, no patch call is issued.
 */
interface ListMergePortAdapter<TCore> extends BusinessContextListMergeAdapter<TCore> {
  readonly applyPatch: (args: {
    ctx: DualSyncBatchExportContext;
    merged: ReadonlyArray<TCore>;
  }) => Promise<void>;
}

async function applyListMergeBatch<TCore>(
  ctx: DualSyncBatchExportContext,
  adapter: ListMergePortAdapter<TCore>,
): Promise<DualSyncBatchExportResult> {
  const plan = planBusinessContextListMergeBatch(ctx, adapter);
  if (!plan.supported) return { supported: false };
  if (plan.exportable.length === 0) return { supported: true, perField: plan.perField };

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });

  try {
    await adapter.applyPatch({ ctx, merged: plan.merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      supported: true,
      perField: markBusinessContextBatchPatchFailure(
        ctx.decisions,
        plan.perField,
        `Batch export failed: ${message}`,
      ),
    };
  }

  const perField = { ...plan.perField };
  for (const exportable of plan.exportable) {
    const configResult = resolveBusinessContextExportFieldConfig(registry, exportable.fieldKey);
    if (configResult.status === 'failed') {
      perField[exportable.fieldKey] = configResult.result;
      continue;
    }
    perField[exportable.fieldKey] = buildBusinessContextExportSuccess(
      configResult.config,
      exportable.coreEntry,
    );
  }

  return { supported: true, perField };
}

export async function applyBusinessContextCategoryExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  return applyListMergeBatch<DualSyncCategoryValue>(ctx, {
    fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
    identify: (e) => slugifyDisplay(e.displayName),
    readCoreList: (s) => s.businessContext?.categories ?? [],
    readGoogleList: (s) => s.businessContext?.categories ?? [],
    missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
    applyPatch: async ({ ctx: c, merged }) => {
      await patchRestaurantGoogleBusinessProfileLocationFields({
        restaurantId: c.restaurantId,
        locationPatch: { categories: buildGoogleCategoriesPatch(merged) },
        updateMask: ['categories'],
        client: c.client,
      });
    },
  });
}

export async function applyBusinessContextServiceAreaExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  return applyListMergeBatch<DualSyncServiceAreaValue>(ctx, {
    fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.serviceArea,
    identify: (e) => slugifyDisplay(e.displayName),
    readCoreList: (s) => s.businessContext?.serviceAreas ?? [],
    readGoogleList: (s) => s.businessContext?.serviceAreas ?? [],
    missingMessage: (id) => `Core snapshot is missing service area ${id}; cannot export.`,
    applyPatch: async ({ ctx: c, merged }) => {
      await patchRestaurantGoogleBusinessProfileLocationFields({
        restaurantId: c.restaurantId,
        locationPatch: { serviceArea: buildGoogleServiceAreaPatch(merged) },
        updateMask: ['serviceArea'],
        client: c.client,
      });
    },
  });
}

export async function applyBusinessContextServiceItemExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  return applyListMergeBatch<DualSyncServiceItemValue>(ctx, {
    fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.serviceItem,
    identify: (e) => e.itemKey,
    readCoreList: (s) => s.businessContext?.serviceItems ?? [],
    readGoogleList: (s) => s.businessContext?.serviceItems ?? [],
    missingMessage: (id) => `Core snapshot is missing service item ${id}; cannot export.`,
    applyPatch: async ({ ctx: c, merged }) => {
      await patchRestaurantGoogleBusinessProfileLocationFields({
        restaurantId: c.restaurantId,
        locationPatch: { serviceItems: buildGoogleServiceItemsPatch(merged) },
        updateMask: ['serviceItems'],
        client: c.client,
      });
    },
  });
}

/**
 * Attributes batch port. The Google API uses
 * `attributesPatch.attributes[]` + `attributeMask[]` rather than the
 * generic location patch, so each decision contributes one entry to
 * each array. The mask tells Google which attributes to overwrite; any
 * existing on-Google attribute outside the mask is left untouched.
 */
export async function applyBusinessContextAttributeExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  const plan = planBusinessContextAttributeBatch(ctx.decisions, ctx.coreSnapshot);
  if (!plan.supported) return { supported: false };
  if (plan.exportable.length === 0) return { supported: true, perField: plan.perField };

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });

  const attributes = plan.exportable.map((entry) => buildGoogleAttribute(entry.coreEntry));
  const attributeMask = plan.exportable.map((entry) => normalizeAttributeName(entry.coreEntry));

  try {
    await patchRestaurantGoogleBusinessProfileLocationFields({
      restaurantId: ctx.restaurantId,
      attributesPatch: { attributes, attributeMask },
      client: ctx.client,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      supported: true,
      perField: markBusinessContextBatchPatchFailure(
        plan.exportable,
        plan.perField,
        `Attributes batch export failed: ${message}`,
      ),
    };
  }

  const perField = { ...plan.perField };
  for (const entry of plan.exportable) {
    const configResult = resolveBusinessContextExportFieldConfig(registry, entry.fieldKey);
    if (configResult.status === 'failed') {
      perField[entry.fieldKey] = configResult.result;
      continue;
    }
    perField[entry.fieldKey] = buildBusinessContextExportSuccess(
      configResult.config,
      entry.coreEntry,
    );
  }

  return { supported: true, perField };
}
