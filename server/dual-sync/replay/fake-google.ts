import { hashCanonicalJson } from '../hashing';
import { buildRegistry, findFieldConfig, type DualSyncFieldConfig } from '../registry';
import { slugifyDisplay } from '../registry/normalizers';

import type { DualSyncOrchestratorPorts } from '../publish/ports';
import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationFailure,
  DualSyncOperationResult,
} from '../publish/types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncGoogleUpdateMask, DualSyncSectionKey } from '../types';

export type DualSyncFakeGoogleOperation =
  | 'locations.get'
  | 'locations.patch'
  | 'locations.updateAttributes'
  | 'categories.list'
  | 'attributes.list'
  | 'services.list'
  | 'foodMenus.replace'
  | 'token.refresh';

export interface DualSyncFakeGoogleRequest {
  readonly operation: DualSyncFakeGoogleOperation;
  readonly validateOnly: boolean;
  readonly fieldKeys: ReadonlyArray<string>;
  readonly updateMask?: ReadonlyArray<DualSyncGoogleUpdateMask>;
  readonly attributeMask?: ReadonlyArray<string>;
  readonly payload: unknown;
}

export interface DualSyncFakeGoogleFailure {
  readonly operation: DualSyncFakeGoogleOperation;
  readonly failure: DualSyncOperationFailure;
  readonly once?: boolean;
}

export interface DualSyncFakeGoogleFieldFailure {
  readonly fieldKey: string;
  readonly failure: DualSyncOperationFailure;
  readonly once?: boolean;
}

export interface DualSyncFakeGoogleInitialState {
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
}

interface MutableSnapshots {
  coreSnapshot: DualSyncCanonicalSnapshot;
  gbpSnapshot: DualSyncCanonicalSnapshot;
}

type WritableSnapshot = {
  -readonly [K in keyof DualSyncCanonicalSnapshot]: DualSyncCanonicalSnapshot[K];
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function writableSnapshot(snapshot: DualSyncCanonicalSnapshot): WritableSnapshot {
  return snapshot as WritableSnapshot;
}

function sectionValue(
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

function profileFieldName(fieldKey: string): string | null {
  if (!fieldKey.startsWith('profile.')) return null;
  const field = fieldKey.slice('profile.'.length);
  return field.length > 0 ? field : null;
}

function copyProfileField(input: {
  readonly source: DualSyncCanonicalSnapshot;
  readonly target: DualSyncCanonicalSnapshot;
  readonly fieldKey: string;
}): void {
  const field = profileFieldName(input.fieldKey);
  if (!field) return;
  const sourceProfile = input.source.profile as unknown as Record<string, unknown>;
  const targetProfile = cloneJson(input.target.profile) as unknown as Record<string, unknown>;
  targetProfile[field] = cloneJson(sourceProfile[field] ?? null);
  writableSnapshot(input.target).profile =
    targetProfile as unknown as DualSyncCanonicalSnapshot['profile'];
}

function replaceByKey<T>(
  rows: ReadonlyArray<T>,
  next: T | null,
  matches: (row: T) => boolean,
): ReadonlyArray<T> {
  if (next === null) return rows.filter((row) => !matches(row));
  const output: T[] = [];
  let replaced = false;
  for (const row of rows) {
    if (matches(row)) {
      if (!replaced) output.push(cloneJson(next));
      replaced = true;
      continue;
    }
    output.push(cloneJson(row));
  }
  if (!replaced) output.push(cloneJson(next));
  return output;
}

function copyOperatingHoursDay(input: {
  readonly source: DualSyncCanonicalSnapshot;
  readonly target: DualSyncCanonicalSnapshot;
  readonly fieldKey: string;
}): void {
  const day = Number.parseInt(input.fieldKey.slice('operatingHours.weekly.'.length), 10);
  if (!Number.isInteger(day)) return;
  const sourceDay = input.source.operatingHours.weekly.find((row) => row.dayOfWeek === day) ?? null;
  writableSnapshot(input.target).operatingHours = {
    weekly: replaceByKey(
      input.target.operatingHours.weekly,
      sourceDay,
      (row) => row.dayOfWeek === day,
    ),
  };
}

function copyServicePeriod(input: {
  readonly source: DualSyncCanonicalSnapshot;
  readonly target: DualSyncCanonicalSnapshot;
  readonly config: DualSyncFieldConfig;
}): void {
  const next =
    input.config.normalizeCoreValue(sectionValue(input.source, 'servicePeriods')) ??
    input.config.normalizeGbpValue(sectionValue(input.source, 'servicePeriods'));
  const stableKey = input.config.fieldKey.slice('servicePeriods.'.length);
  writableSnapshot(input.target).servicePeriods = {
    periods: replaceByKey(
      input.target.servicePeriods.periods,
      next as DualSyncCanonicalSnapshot['servicePeriods']['periods'][number] | null,
      (row) => row.stableKey === stableKey,
    ),
  };
}

function copyBusinessContextRow(input: {
  readonly source: DualSyncCanonicalSnapshot;
  readonly target: DualSyncCanonicalSnapshot;
  readonly config: DualSyncFieldConfig;
}): void {
  const { config } = input;
  const sourceSection = sectionValue(input.source, config.sectionKey);
  const next = config.normalizeCoreValue(sourceSection) ?? config.normalizeGbpValue(sourceSection);
  switch (config.kind) {
    case 'businessContext.category': {
      const slug = config.fieldKey.slice('businessContext.categories.'.length);
      writableSnapshot(input.target).businessContext = {
        ...input.target.businessContext,
        categories: replaceByKey(
          input.target.businessContext.categories,
          next as DualSyncCanonicalSnapshot['businessContext']['categories'][number] | null,
          (row) => slugifyDisplay(row.displayName) === slug,
        ),
      };
      break;
    }
    case 'businessContext.serviceArea': {
      const slug = config.fieldKey.slice('businessContext.serviceAreas.'.length);
      writableSnapshot(input.target).businessContext = {
        ...input.target.businessContext,
        serviceAreas: replaceByKey(
          input.target.businessContext.serviceAreas,
          next as DualSyncCanonicalSnapshot['businessContext']['serviceAreas'][number] | null,
          (row) => slugifyDisplay(row.displayName) === slug,
        ),
      };
      break;
    }
    case 'businessContext.attribute': {
      const key = config.fieldKey.slice('businessContext.attributes.'.length);
      writableSnapshot(input.target).businessContext = {
        ...input.target.businessContext,
        attributes: replaceByKey(
          input.target.businessContext.attributes,
          next as DualSyncCanonicalSnapshot['businessContext']['attributes'][number] | null,
          (row) => row.attributeKey === key,
        ),
      };
      break;
    }
    case 'businessContext.serviceItem': {
      const key = config.fieldKey.slice('businessContext.serviceItems.'.length);
      writableSnapshot(input.target).businessContext = {
        ...input.target.businessContext,
        serviceItems: replaceByKey(
          input.target.businessContext.serviceItems,
          next as DualSyncCanonicalSnapshot['businessContext']['serviceItems'][number] | null,
          (row) => row.itemKey === key,
        ),
      };
      break;
    }
    default:
      break;
  }
}

function copyFoodMenus(input: {
  readonly source: DualSyncCanonicalSnapshot;
  readonly target: DualSyncCanonicalSnapshot;
}): void {
  writableSnapshot(input.target).foodMenus = cloneJson(input.source.foodMenus ?? { items: [] });
}

function copyField(input: {
  readonly source: DualSyncCanonicalSnapshot;
  readonly target: DualSyncCanonicalSnapshot;
  readonly config: DualSyncFieldConfig;
}): void {
  switch (input.config.kind) {
    case 'profile':
      copyProfileField({ ...input, fieldKey: input.config.fieldKey });
      break;
    case 'operatingHours.weekly':
      copyOperatingHoursDay({ ...input, fieldKey: input.config.fieldKey });
      break;
    case 'servicePeriod':
      copyServicePeriod(input);
      break;
    case 'businessContext.category':
    case 'businessContext.serviceArea':
    case 'businessContext.attribute':
    case 'businessContext.serviceItem':
      copyBusinessContextRow(input);
      break;
    case 'foodMenu.item':
      copyFoodMenus(input);
      break;
    case 'core_only':
      break;
    default:
      break;
  }
}

function fieldHash(input: {
  readonly snapshot: DualSyncCanonicalSnapshot;
  readonly config: DualSyncFieldConfig;
  readonly side: 'core' | 'gbp';
}): string | null {
  const value = sectionValue(input.snapshot, input.config.sectionKey);
  const canonical =
    input.side === 'core'
      ? input.config.canonicalizeCoreValue(value)
      : input.config.canonicalizeGbpValue(value);
  return hashCanonicalJson(canonical);
}

function updateMasksFor(
  configs: ReadonlyArray<DualSyncFieldConfig>,
): ReadonlyArray<DualSyncGoogleUpdateMask> {
  return Array.from(
    new Set(configs.map((config) => config.googleUpdateMask).filter(Boolean)),
  ) as ReadonlyArray<DualSyncGoogleUpdateMask>;
}

function attributeMaskFor(configs: ReadonlyArray<DualSyncFieldConfig>): ReadonlyArray<string> {
  return configs
    .filter((config) => config.kind === 'businessContext.attribute')
    .map((config) => config.fieldKey.slice('businessContext.attributes.'.length));
}

export class FakeGoogleBusinessProfileAdapter {
  private readonly snapshots: MutableSnapshots;
  private readonly requestsInternal: DualSyncFakeGoogleRequest[] = [];
  private readonly failures: DualSyncFakeGoogleFailure[] = [];
  private readonly fieldFailures: DualSyncFakeGoogleFieldFailure[] = [];

  constructor(initialState: DualSyncFakeGoogleInitialState) {
    this.snapshots = {
      coreSnapshot: cloneJson(initialState.coreSnapshot),
      gbpSnapshot: cloneJson(initialState.gbpSnapshot),
    };
  }

  get requests(): ReadonlyArray<DualSyncFakeGoogleRequest> {
    return this.requestsInternal.map((request) => cloneJson(request));
  }

  get coreSnapshot(): DualSyncCanonicalSnapshot {
    return cloneJson(this.snapshots.coreSnapshot);
  }

  get gbpSnapshot(): DualSyncCanonicalSnapshot {
    return cloneJson(this.snapshots.gbpSnapshot);
  }

  failNext(failure: DualSyncFakeGoogleFailure): void {
    this.failures.push(failure);
  }

  failField(failure: DualSyncFakeGoogleFieldFailure): void {
    this.fieldFailures.push(failure);
  }

  createPorts(): DualSyncOrchestratorPorts {
    return createFakeGoogleBusinessProfilePorts(this);
  }

  async locationsGet(): Promise<DualSyncCanonicalSnapshot> {
    this.maybeFail('locations.get');
    this.record({
      operation: 'locations.get',
      validateOnly: false,
      fieldKeys: [],
      payload: null,
    });
    return this.gbpSnapshot;
  }

  async categoriesList(): Promise<DualSyncCanonicalSnapshot['businessContext']['categories']> {
    this.maybeFail('categories.list');
    this.record({
      operation: 'categories.list',
      validateOnly: false,
      fieldKeys: [],
      payload: null,
    });
    return this.gbpSnapshot.businessContext.categories;
  }

  async attributesList(): Promise<DualSyncCanonicalSnapshot['businessContext']['attributes']> {
    this.maybeFail('attributes.list');
    this.record({
      operation: 'attributes.list',
      validateOnly: false,
      fieldKeys: [],
      payload: null,
    });
    return this.gbpSnapshot.businessContext.attributes;
  }

  async servicesList(): Promise<DualSyncCanonicalSnapshot['businessContext']['serviceItems']> {
    this.maybeFail('services.list');
    this.record({
      operation: 'services.list',
      validateOnly: false,
      fieldKeys: [],
      payload: null,
    });
    return this.gbpSnapshot.businessContext.serviceItems;
  }

  async refreshToken(): Promise<void> {
    this.maybeFail('token.refresh');
    this.record({
      operation: 'token.refresh',
      validateOnly: false,
      fieldKeys: [],
      payload: null,
    });
  }

  async exportFieldsToGoogle(input: {
    readonly decisions: ReadonlyArray<{ readonly fieldKey: string }>;
    readonly validateOnly?: boolean;
  }): Promise<Record<string, DualSyncOperationResult>> {
    const registry = this.registry();
    const configs = this.configsFor(
      registry,
      input.decisions.map((decision) => decision.fieldKey),
    );
    const masks = updateMasksFor(configs);
    const fieldKeys = configs.map((config) => config.fieldKey);
    const operation = configs.some((config) => config.sectionKey === 'foodMenus')
      ? 'foodMenus.replace'
      : configs.some((config) => config.sectionKey === 'businessContext.attributes')
        ? 'locations.updateAttributes'
        : 'locations.patch';

    this.record({
      operation,
      validateOnly: input.validateOnly ?? false,
      fieldKeys,
      updateMask: operation === 'locations.patch' ? masks : undefined,
      attributeMask:
        operation === 'locations.updateAttributes' ? attributeMaskFor(configs) : undefined,
      payload: {
        source: 'core',
        writeGroups: Array.from(new Set(configs.map((config) => config.policy.googleWriteGroup))),
      },
    });
    this.maybeFail(operation);

    const perFieldFailures = new Map<string, DualSyncOperationFailure>();
    for (const config of configs) {
      const failure = this.consumeFieldFailure(config.fieldKey);
      if (failure) {
        perFieldFailures.set(config.fieldKey, failure);
      }
    }

    if (!(input.validateOnly ?? false)) {
      for (const config of configs) {
        if (perFieldFailures.has(config.fieldKey)) continue;
        copyField({
          source: this.snapshots.coreSnapshot,
          target: this.snapshots.gbpSnapshot,
          config,
        });
      }
    }

    return this.resultByField(configs, 'gbp', perFieldFailures);
  }

  async importFieldsToCore(input: {
    readonly decisions: ReadonlyArray<{ readonly fieldKey: string }>;
  }): Promise<Record<string, DualSyncOperationResult>> {
    const registry = this.registry();
    const configs = this.configsFor(
      registry,
      input.decisions.map((decision) => decision.fieldKey),
    );
    const fieldKeys = configs.map((config) => config.fieldKey);
    this.record({
      operation: 'locations.get',
      validateOnly: false,
      fieldKeys,
      payload: { source: 'gbp' },
    });
    this.maybeFail('locations.get');

    const perFieldFailures = new Map<string, DualSyncOperationFailure>();
    for (const config of configs) {
      const failure = this.consumeFieldFailure(config.fieldKey);
      if (failure) {
        perFieldFailures.set(config.fieldKey, failure);
        continue;
      }
      copyField({
        source: this.snapshots.gbpSnapshot,
        target: this.snapshots.coreSnapshot,
        config,
      });
    }

    return this.resultByField(configs, 'core', perFieldFailures);
  }

  private registry(): ReadonlyArray<DualSyncFieldConfig> {
    return buildRegistry({
      coreSnapshot: this.snapshots.coreSnapshot,
      gbpSnapshot: this.snapshots.gbpSnapshot,
      includeCoreOnly: false,
    });
  }

  private configsFor(
    registry: ReadonlyArray<DualSyncFieldConfig>,
    fieldKeys: ReadonlyArray<string>,
  ): ReadonlyArray<DualSyncFieldConfig> {
    return fieldKeys.map((fieldKey) => {
      const config = findFieldConfig(registry, fieldKey);
      if (!config) {
        throw new Error(`Fake Google replay field is not in the registry: ${fieldKey}`);
      }
      return config;
    });
  }

  private resultByField(
    configs: ReadonlyArray<DualSyncFieldConfig>,
    side: 'core' | 'gbp',
    failures: ReadonlyMap<string, DualSyncOperationFailure> = new Map(),
  ): Record<string, DualSyncOperationResult> {
    const snapshot = side === 'core' ? this.snapshots.coreSnapshot : this.snapshots.gbpSnapshot;
    const result: Record<string, DualSyncOperationResult> = {};
    for (const config of configs) {
      const failure = failures.get(config.fieldKey);
      if (failure) {
        result[config.fieldKey] = {
          status: 'failed',
          failure,
        };
        continue;
      }
      const hash = fieldHash({ snapshot, config, side });
      result[config.fieldKey] = {
        status: 'succeeded',
        afterCoreHash: side === 'core' ? hash : undefined,
        afterGbpHash: side === 'gbp' ? hash : undefined,
      };
    }
    return result;
  }

  private record(request: DualSyncFakeGoogleRequest): void {
    this.requestsInternal.push(cloneJson(request));
  }

  private consumeFieldFailure(fieldKey: string): DualSyncOperationFailure | null {
    const index = this.fieldFailures.findIndex((failure) => failure.fieldKey === fieldKey);
    if (index === -1) return null;
    const failure = this.fieldFailures[index]!;
    if (failure.once ?? true) {
      this.fieldFailures.splice(index, 1);
    }
    return failure.failure;
  }

  private maybeFail(operation: DualSyncFakeGoogleOperation): void {
    const index = this.failures.findIndex((failure) => failure.operation === operation);
    if (index === -1) return;
    const failure = this.failures[index]!;
    if (failure.once ?? true) {
      this.failures.splice(index, 1);
    }
    throw Object.assign(new Error(failure.failure.message), {
      dualSyncFailure: failure.failure,
    });
  }
}

function resultFromThrown(error: unknown): DualSyncOperationResult {
  const maybeFailure =
    typeof error === 'object' && error !== null
      ? (error as { dualSyncFailure?: DualSyncOperationFailure }).dualSyncFailure
      : undefined;
  return {
    status: 'failed',
    failure: maybeFailure ?? {
      code: 'EXTERNAL_API_ERROR',
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    },
  };
}

export function createFakeGoogleBusinessProfilePorts(
  adapter: FakeGoogleBusinessProfileAdapter,
): DualSyncOrchestratorPorts {
  return {
    applyImportToCore: async (ctx: DualSyncOperationContext): Promise<DualSyncOperationResult> => {
      try {
        const result = await adapter.importFieldsToCore({ decisions: [ctx.decision] });
        return (
          result[ctx.decision.fieldKey] ?? {
            status: 'failed',
            failure: {
              code: 'PORT_FAILURE',
              message: `Fake Google import did not return ${ctx.decision.fieldKey}.`,
              retryable: false,
            },
          }
        );
      } catch (error) {
        return resultFromThrown(error);
      }
    },
    applyExportToGoogle: async (
      ctx: DualSyncOperationContext,
    ): Promise<DualSyncOperationResult> => {
      try {
        const result = await adapter.exportFieldsToGoogle({ decisions: [ctx.decision] });
        return (
          result[ctx.decision.fieldKey] ?? {
            status: 'failed',
            failure: {
              code: 'PORT_FAILURE',
              message: `Fake Google export did not return ${ctx.decision.fieldKey}.`,
              retryable: false,
            },
          }
        );
      } catch (error) {
        return resultFromThrown(error);
      }
    },
    applyExportBatchToGoogle: async (
      ctx: DualSyncBatchExportContext,
    ): Promise<DualSyncBatchExportResult> => {
      try {
        return {
          supported: true,
          perField: await adapter.exportFieldsToGoogle({ decisions: ctx.decisions }),
        };
      } catch (error) {
        const failure = resultFromThrown(error);
        return {
          supported: true,
          perField: Object.fromEntries(
            ctx.decisions.map((decision) => [decision.fieldKey, failure]),
          ),
        };
      }
    },
  };
}
