import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig } from '../../registry';

import type { DualSyncFieldConfig } from '../../registry';
import type { DualSyncAttributeValue, DualSyncCanonicalSnapshot } from '../../snapshots/types';
import type {
  DualSyncBatchExportContext,
  DualSyncOperationResult,
  DualSyncPublishDecision,
} from '../types';

export const BUSINESS_CONTEXT_EXPORT_PREFIX = {
  category: 'businessContext.categories.',
  serviceArea: 'businessContext.serviceAreas.',
  attribute: 'businessContext.attributes.',
  serviceItem: 'businessContext.serviceItems.',
} as const;

export function parseBusinessContextExportId(fieldKey: string, prefix: string): string | null {
  if (!fieldKey.startsWith(prefix)) return null;
  const tail = fieldKey.slice(prefix.length);
  return tail.length > 0 ? tail : null;
}

export function buildBusinessContextExportPortFailure(
  message: string,
  retryable = false,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

export function buildBusinessContextExportRegistryFailure(
  fieldKey: string,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

export function resolveBusinessContextExportFieldConfig(
  registry: ReadonlyArray<DualSyncFieldConfig>,
  fieldKey: string,
):
  | {
      readonly status: 'ready';
      readonly config: DualSyncFieldConfig;
    }
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    } {
  const config = findFieldConfig(registry, fieldKey);
  if (!config) {
    return { status: 'failed', result: buildBusinessContextExportRegistryFailure(fieldKey) };
  }
  return { status: 'ready', config };
}

export function buildBusinessContextExportSuccess(
  config: DualSyncFieldConfig,
  coreEntry: unknown,
): DualSyncOperationResult {
  const canonical = config.canonicalizeCoreValue([coreEntry]);
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

export interface BusinessContextListMergeAdapter<TCore> {
  readonly fieldPrefix: string;
  readonly identify: (entry: TCore) => string;
  readonly readCoreList: (snapshot: DualSyncCanonicalSnapshot) => ReadonlyArray<TCore>;
  readonly readGoogleList: (snapshot: DualSyncCanonicalSnapshot) => ReadonlyArray<TCore>;
  readonly missingMessage: (id: string) => string;
}

export interface BusinessContextSingleListExportAdapter<
  TCore,
> extends BusinessContextListMergeAdapter<TCore> {
  readonly unsupportedMessage: (fieldKey: string) => string;
}

export type BusinessContextSingleListExportPlan<TCore> =
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    }
  | {
      readonly status: 'ready';
      readonly id: string;
      readonly config: DualSyncFieldConfig;
      readonly coreEntry: TCore;
      readonly merged: ReadonlyArray<TCore>;
    };

export function planBusinessContextSingleListExport<TCore>(
  ctx: {
    readonly fieldKey: string;
    readonly registry: ReadonlyArray<DualSyncFieldConfig>;
    readonly coreSnapshot: DualSyncCanonicalSnapshot;
    readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  },
  adapter: BusinessContextSingleListExportAdapter<TCore>,
): BusinessContextSingleListExportPlan<TCore> {
  const id = parseBusinessContextExportId(ctx.fieldKey, adapter.fieldPrefix);
  if (!id) {
    return {
      status: 'failed',
      result: buildBusinessContextExportPortFailure(adapter.unsupportedMessage(ctx.fieldKey)),
    };
  }

  const configResult = resolveBusinessContextExportFieldConfig(ctx.registry, ctx.fieldKey);
  if (configResult.status === 'failed') {
    return { status: 'failed', result: configResult.result };
  }

  const coreEntry =
    adapter.readCoreList(ctx.coreSnapshot).find((entry) => adapter.identify(entry) === id) ?? null;

  if (!coreEntry) {
    return {
      status: 'failed',
      result: buildBusinessContextExportPortFailure(adapter.missingMessage(id), false),
    };
  }

  const others = adapter
    .readGoogleList(ctx.gbpSnapshot)
    .filter((entry) => adapter.identify(entry) !== id);

  return {
    status: 'ready',
    id,
    config: configResult.config,
    coreEntry,
    merged: [...others, coreEntry],
  };
}

export interface BusinessContextResolvedListDecision<TCore> {
  readonly fieldKey: string;
  readonly id: string;
  readonly coreEntry: TCore;
}

export type BusinessContextListMergePlan<TCore> =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly perField: Record<string, DualSyncOperationResult>;
      readonly exportable: ReadonlyArray<BusinessContextResolvedListDecision<TCore>>;
      readonly merged: ReadonlyArray<TCore>;
    };

export function planBusinessContextListMergeBatch<TCore>(
  ctx: Pick<DualSyncBatchExportContext, 'decisions' | 'coreSnapshot' | 'gbpSnapshot'>,
  adapter: BusinessContextListMergeAdapter<TCore>,
): BusinessContextListMergePlan<TCore> {
  const { decisions } = ctx;
  if (decisions.length === 0) {
    return { supported: true, perField: {}, exportable: [], merged: [] };
  }

  const perField: Record<string, DualSyncOperationResult> = {};
  const ids: string[] = [];
  const exportable: Array<BusinessContextResolvedListDecision<TCore>> = [];

  for (const decision of decisions) {
    const id = parseBusinessContextExportId(decision.fieldKey, adapter.fieldPrefix);
    if (!id) return { supported: false };
    ids.push(id);
    const coreEntry =
      adapter.readCoreList(ctx.coreSnapshot).find((entry) => adapter.identify(entry) === id) ??
      null;
    if (!coreEntry) {
      perField[decision.fieldKey] = buildBusinessContextExportPortFailure(
        adapter.missingMessage(id),
        false,
      );
      continue;
    }
    exportable.push({ fieldKey: decision.fieldKey, id, coreEntry });
  }

  if (exportable.length === 0) {
    return { supported: true, perField, exportable, merged: [] };
  }

  const idSet = new Set(ids);
  const others = adapter
    .readGoogleList(ctx.gbpSnapshot)
    .filter((entry) => !idSet.has(adapter.identify(entry)));

  return {
    supported: true,
    perField,
    exportable,
    merged: [...others, ...exportable.map((entry) => entry.coreEntry)],
  };
}

export interface BusinessContextResolvedAttributeDecision {
  readonly fieldKey: string;
  readonly attributeKey: string;
  readonly coreEntry: DualSyncAttributeValue;
}

export type BusinessContextSingleAttributeExportPlan =
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    }
  | {
      readonly status: 'ready';
      readonly attributeKey: string;
      readonly config: DualSyncFieldConfig;
      readonly coreEntry: DualSyncAttributeValue;
    };

export function planBusinessContextSingleAttributeExport(ctx: {
  readonly fieldKey: string;
  readonly registry: ReadonlyArray<DualSyncFieldConfig>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
}): BusinessContextSingleAttributeExportPlan {
  const attributeKey = parseBusinessContextExportId(
    ctx.fieldKey,
    BUSINESS_CONTEXT_EXPORT_PREFIX.attribute,
  );
  if (!attributeKey) {
    return {
      status: 'failed',
      result: buildBusinessContextExportPortFailure(
        `Attributes export port does not handle ${ctx.fieldKey}.`,
      ),
    };
  }

  const configResult = resolveBusinessContextExportFieldConfig(ctx.registry, ctx.fieldKey);
  if (configResult.status === 'failed') {
    return { status: 'failed', result: configResult.result };
  }

  const coreEntry =
    ctx.coreSnapshot.businessContext?.attributes.find(
      (attribute) => attribute.attributeKey === attributeKey,
    ) ?? null;
  if (!coreEntry) {
    return {
      status: 'failed',
      result: buildBusinessContextExportPortFailure(
        `Core snapshot is missing attribute ${attributeKey}; cannot export.`,
        false,
      ),
    };
  }

  return { status: 'ready', attributeKey, config: configResult.config, coreEntry };
}

export type BusinessContextAttributeBatchPlan =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly perField: Record<string, DualSyncOperationResult>;
      readonly exportable: ReadonlyArray<BusinessContextResolvedAttributeDecision>;
    };

export function planBusinessContextAttributeBatch(
  decisions: ReadonlyArray<DualSyncPublishDecision>,
  coreSnapshot: DualSyncCanonicalSnapshot,
): BusinessContextAttributeBatchPlan {
  if (decisions.length === 0) {
    return { supported: true, perField: {}, exportable: [] };
  }

  const perField: Record<string, DualSyncOperationResult> = {};
  const exportable: BusinessContextResolvedAttributeDecision[] = [];

  for (const decision of decisions) {
    const attributeKey = parseBusinessContextExportId(
      decision.fieldKey,
      BUSINESS_CONTEXT_EXPORT_PREFIX.attribute,
    );
    if (!attributeKey) return { supported: false };
    const coreEntry =
      coreSnapshot.businessContext?.attributes.find(
        (attribute) => attribute.attributeKey === attributeKey,
      ) ?? null;
    if (!coreEntry) {
      perField[decision.fieldKey] = buildBusinessContextExportPortFailure(
        `Core snapshot is missing attribute ${attributeKey}; cannot export.`,
        false,
      );
      continue;
    }
    exportable.push({ fieldKey: decision.fieldKey, attributeKey, coreEntry });
  }

  return { supported: true, perField, exportable };
}

export function markBusinessContextBatchPatchFailure(
  decisions: ReadonlyArray<Pick<DualSyncPublishDecision, 'fieldKey'>>,
  existingPerField: Record<string, DualSyncOperationResult>,
  message: string,
): Record<string, DualSyncOperationResult> {
  const perField = { ...existingPerField };
  for (const decision of decisions) {
    if (perField[decision.fieldKey]) continue;
    perField[decision.fieldKey] = buildBusinessContextExportPortFailure(message, true);
  }
  return perField;
}
