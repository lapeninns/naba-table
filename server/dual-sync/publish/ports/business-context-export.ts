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
  buildGoogleAttribute,
  buildGoogleCategoriesPatch,
  buildGoogleServiceAreaPatch,
  buildGoogleServiceItemsPatch,
  normalizeAttributeName,
} from './google-patch-builders';
import { hashCanonicalJson } from '../../hashing';
import { buildRegistry, findFieldConfig } from '../../registry';
import { slugifyDisplay } from '../../registry/normalizers';

import type {
  DualSyncAttributeValue,
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

const PREFIX = {
  category: 'businessContext.categories.',
  serviceArea: 'businessContext.serviceAreas.',
  attribute: 'businessContext.attributes.',
  serviceItem: 'businessContext.serviceItems.',
} as const;

function parseSlug(fieldKey: string, prefix: string): string | null {
  if (!fieldKey.startsWith(prefix)) return null;
  const tail = fieldKey.slice(prefix.length);
  return tail.length > 0 ? tail : null;
}

function failedPort(message: string, retryable = false): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

function failedRegistry(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function applyBusinessContextCategoryExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const slug = parseSlug(ctx.decision.fieldKey, PREFIX.category);
  if (!slug) return failedPort(`Categories export port does not handle ${ctx.decision.fieldKey}.`);

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const coreEntry =
    ctx.coreSnapshot.businessContext?.categories.find(
      (c) => slugifyDisplay(c.displayName) === slug,
    ) ?? null;

  if (!coreEntry) {
    return failedPort(`Core snapshot is missing category ${slug}; cannot export.`, false);
  }

  const googleList = ctx.gbpSnapshot.businessContext?.categories ?? [];
  const others = googleList.filter((c) => slugifyDisplay(c.displayName) !== slug);
  const merged: ReadonlyArray<DualSyncCategoryValue> = [...others, coreEntry];

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    locationPatch: { categories: buildGoogleCategoriesPatch(merged) },
    updateMask: ['categories'],
    client: ctx.client,
  });

  const canonical = config.canonicalizeCoreValue([coreEntry]);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

// ---------------------------------------------------------------------------
// Service areas
// ---------------------------------------------------------------------------

export async function applyBusinessContextServiceAreaExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const slug = parseSlug(ctx.decision.fieldKey, PREFIX.serviceArea);
  if (!slug) {
    return failedPort(`Service-areas export port does not handle ${ctx.decision.fieldKey}.`);
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const coreEntry =
    ctx.coreSnapshot.businessContext?.serviceAreas.find(
      (a) => slugifyDisplay(a.displayName) === slug,
    ) ?? null;
  if (!coreEntry) {
    return failedPort(`Core snapshot is missing service area ${slug}; cannot export.`, false);
  }

  const googleList = ctx.gbpSnapshot.businessContext?.serviceAreas ?? [];
  const others = googleList.filter((a) => slugifyDisplay(a.displayName) !== slug);
  const merged: ReadonlyArray<DualSyncServiceAreaValue> = [...others, coreEntry];

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    locationPatch: { serviceArea: buildGoogleServiceAreaPatch(merged) },
    updateMask: ['serviceArea'],
    client: ctx.client,
  });

  const canonical = config.canonicalizeCoreValue([coreEntry]);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

export async function applyBusinessContextAttributeExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const attributeKey = parseSlug(ctx.decision.fieldKey, PREFIX.attribute);
  if (!attributeKey) {
    return failedPort(`Attributes export port does not handle ${ctx.decision.fieldKey}.`);
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const coreEntry: DualSyncAttributeValue | null =
    ctx.coreSnapshot.businessContext?.attributes.find((a) => a.attributeKey === attributeKey) ??
    null;
  if (!coreEntry) {
    return failedPort(`Core snapshot is missing attribute ${attributeKey}; cannot export.`, false);
  }

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    attributesPatch: {
      attributes: [buildGoogleAttribute(coreEntry)],
      attributeMask: [normalizeAttributeName(coreEntry)],
    },
    client: ctx.client,
  });

  const canonical = config.canonicalizeCoreValue([coreEntry]);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

// ---------------------------------------------------------------------------
// Service items
// ---------------------------------------------------------------------------

export async function applyBusinessContextServiceItemExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const itemKey = parseSlug(ctx.decision.fieldKey, PREFIX.serviceItem);
  if (!itemKey) {
    return failedPort(`Service-items export port does not handle ${ctx.decision.fieldKey}.`);
  }

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, ctx.decision.fieldKey);
  if (!config) return failedRegistry(ctx.decision.fieldKey);

  const coreEntry: DualSyncServiceItemValue | null =
    ctx.coreSnapshot.businessContext?.serviceItems.find((s) => s.itemKey === itemKey) ?? null;
  if (!coreEntry) {
    return failedPort(`Core snapshot is missing service item ${itemKey}; cannot export.`, false);
  }

  const googleList = ctx.gbpSnapshot.businessContext?.serviceItems ?? [];
  const others = googleList.filter((s) => s.itemKey !== itemKey);
  const merged: ReadonlyArray<DualSyncServiceItemValue> = [...others, coreEntry];

  await patchRestaurantGoogleBusinessProfileLocationFields({
    restaurantId: ctx.restaurantId,
    locationPatch: { serviceItems: buildGoogleServiceItemsPatch(merged) },
    updateMask: ['serviceItems'],
    client: ctx.client,
  });

  const canonical = config.canonicalizeCoreValue([coreEntry]);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
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
interface ListMergeAdapter<TCore> {
  readonly fieldPrefix: string;
  readonly identify: (entry: TCore) => string;
  readonly readCoreList: (
    snapshot: DualSyncBatchExportContext['coreSnapshot'],
  ) => ReadonlyArray<TCore>;
  readonly readGoogleList: (
    snapshot: DualSyncBatchExportContext['gbpSnapshot'],
  ) => ReadonlyArray<TCore>;
  readonly missingMessage: (id: string) => string;
  readonly applyPatch: (args: {
    ctx: DualSyncBatchExportContext;
    merged: ReadonlyArray<TCore>;
  }) => Promise<void>;
}

async function applyListMergeBatch<TCore>(
  ctx: DualSyncBatchExportContext,
  adapter: ListMergeAdapter<TCore>,
): Promise<DualSyncBatchExportResult> {
  const { decisions } = ctx;
  if (decisions.length === 0) return { supported: true, perField: {} };

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });

  const perField: Record<string, DualSyncOperationResult> = {};
  const ids: string[] = [];
  const idByFieldKey = new Map<string, string>();
  const coreEntries: TCore[] = [];

  for (const decision of decisions) {
    const id = parseSlug(decision.fieldKey, adapter.fieldPrefix);
    if (!id) return { supported: false };
    ids.push(id);
    idByFieldKey.set(decision.fieldKey, id);
    const coreEntry =
      adapter.readCoreList(ctx.coreSnapshot).find((e) => adapter.identify(e) === id) ?? null;
    if (!coreEntry) {
      perField[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: adapter.missingMessage(id),
          retryable: false,
        },
      };
      continue;
    }
    coreEntries.push(coreEntry);
  }

  if (coreEntries.length === 0) {
    return { supported: true, perField };
  }

  const idSet = new Set(ids);
  const others = adapter
    .readGoogleList(ctx.gbpSnapshot)
    .filter((e) => !idSet.has(adapter.identify(e)));
  const merged: ReadonlyArray<TCore> = [...others, ...coreEntries];

  try {
    await adapter.applyPatch({ ctx, merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const decision of decisions) {
      // Only fail the decisions that were going to be applied; leave the
      // pre-existing PORT_FAILURE entries untouched.
      if (perField[decision.fieldKey]) continue;
      perField[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: `Batch export failed: ${message}`,
          retryable: true,
        },
      };
    }
    return { supported: true, perField };
  }

  for (const decision of decisions) {
    if (perField[decision.fieldKey]) continue;
    const id = idByFieldKey.get(decision.fieldKey);
    if (!id) continue;
    const coreEntry =
      adapter.readCoreList(ctx.coreSnapshot).find((e) => adapter.identify(e) === id) ?? null;
    if (!coreEntry) continue;
    const config = findFieldConfig(registry, decision.fieldKey);
    if (!config) {
      perField[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'INVALID_DECISION',
          message: `Field ${decision.fieldKey} is not in the registry.`,
          retryable: false,
        },
      };
      continue;
    }
    const canonical = config.canonicalizeCoreValue([coreEntry]);
    const hash = hashCanonicalJson(canonical);
    perField[decision.fieldKey] = {
      status: 'succeeded',
      afterCoreHash: hash,
      afterGbpHash: hash,
    };
  }

  return { supported: true, perField };
}

export async function applyBusinessContextCategoryExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  return applyListMergeBatch<DualSyncCategoryValue>(ctx, {
    fieldPrefix: PREFIX.category,
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
    fieldPrefix: PREFIX.serviceArea,
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
    fieldPrefix: PREFIX.serviceItem,
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
  const { decisions } = ctx;
  if (decisions.length === 0) return { supported: true, perField: {} };

  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });

  const perField: Record<string, DualSyncOperationResult> = {};

  interface Resolved {
    readonly fieldKey: string;
    readonly attributeKey: string;
    readonly coreEntry: DualSyncAttributeValue | null;
  }

  const resolved: Resolved[] = [];
  for (const decision of decisions) {
    const attributeKey = parseSlug(decision.fieldKey, PREFIX.attribute);
    if (!attributeKey) return { supported: false };
    const coreEntry =
      ctx.coreSnapshot.businessContext?.attributes.find((a) => a.attributeKey === attributeKey) ??
      null;
    if (!coreEntry) {
      perField[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: `Core snapshot is missing attribute ${attributeKey}; cannot export.`,
          retryable: false,
        },
      };
    }
    resolved.push({ fieldKey: decision.fieldKey, attributeKey, coreEntry });
  }

  const exportable = resolved.filter((r) => r.coreEntry !== null);
  if (exportable.length === 0) return { supported: true, perField };

  const attributes = exportable.map((r) => buildGoogleAttribute(r.coreEntry!));
  const attributeMask = exportable.map((r) => normalizeAttributeName(r.coreEntry!));

  try {
    await patchRestaurantGoogleBusinessProfileLocationFields({
      restaurantId: ctx.restaurantId,
      attributesPatch: { attributes, attributeMask },
      client: ctx.client,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const r of exportable) {
      perField[r.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: `Attributes batch export failed: ${message}`,
          retryable: true,
        },
      };
    }
    return { supported: true, perField };
  }

  for (const r of exportable) {
    const config = findFieldConfig(registry, r.fieldKey);
    if (!config) {
      perField[r.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'INVALID_DECISION',
          message: `Field ${r.fieldKey} is not in the registry.`,
          retryable: false,
        },
      };
      continue;
    }
    const canonical = config.canonicalizeCoreValue([r.coreEntry!]);
    const hash = hashCanonicalJson(canonical);
    perField[r.fieldKey] = {
      status: 'succeeded',
      afterCoreHash: hash,
      afterGbpHash: hash,
    };
  }

  return { supported: true, perField };
}
