import { describe, expect, it } from 'vitest';

import {
  BUSINESS_CONTEXT_EXPORT_PREFIX,
  buildBusinessContextExportSuccess,
  parseBusinessContextExportId,
  planBusinessContextAttributeBatch,
  planBusinessContextListMergeBatch,
  planBusinessContextSingleAttributeExport,
  planBusinessContextSingleListExport,
  resolveBusinessContextExportFieldConfig,
} from '@/server/dual-sync/publish/ports/business-context-export-domain';
import { buildRegistry } from '@/server/dual-sync/registry';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type {
  DualSyncCanonicalSnapshot,
  DualSyncCategoryValue,
} from '@/server/dual-sync/snapshots/types';

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: null,
      contactPhone: null,
      address: null,
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...overrides,
  };
}

function makeDecision(fieldKey: string): DualSyncPublishDecision {
  return {
    fieldKey,
    sectionKey: 'businessContext.categories',
    action: 'export_to_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
  };
}

const fineDining: DualSyncCategoryValue = {
  displayName: 'Fine Dining',
  categoryCode: 'gcid:fine_dining',
  isPrimary: true,
  moreHoursTypes: [],
};

const bar: DualSyncCategoryValue = {
  displayName: 'Bar',
  categoryCode: 'gcid:bar',
  isPrimary: false,
  moreHoursTypes: [],
};

const cafe: DualSyncCategoryValue = {
  displayName: 'Cafe',
  categoryCode: 'gcid:cafe',
  isPrimary: false,
  moreHoursTypes: [],
};

const servesDinner = {
  attributeKey: 'serves_dinner',
  attributeName: 'attributes/serves_dinner',
  attributeId: 'serves_dinner',
  valueType: 'BOOL',
  boolValue: true,
  textValue: null,
  uriValue: null,
  uriValues: [],
  enumValues: [],
  unsetEnumValues: [],
} as const;

describe('business-context export domain helpers', () => {
  it('parses only populated field-key tails for a supported prefix', () => {
    expect(
      parseBusinessContextExportId(
        'businessContext.categories.fine-dining',
        BUSINESS_CONTEXT_EXPORT_PREFIX.category,
      ),
    ).toBe('fine-dining');
    expect(
      parseBusinessContextExportId(
        'businessContext.serviceAreas.fine-dining',
        BUSINESS_CONTEXT_EXPORT_PREFIX.category,
      ),
    ).toBeNull();
    expect(
      parseBusinessContextExportId(
        'businessContext.categories.',
        BUSINESS_CONTEXT_EXPORT_PREFIX.category,
      ),
    ).toBeNull();
  });

  it('plans merged list batches while preserving unrelated Google rows', () => {
    const coreSnapshot = makeSnapshot({
      businessContext: {
        categories: [fineDining, bar],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });
    const gbpSnapshot = makeSnapshot({
      businessContext: {
        categories: [cafe],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });

    const plan = planBusinessContextListMergeBatch(
      {
        decisions: [
          makeDecision('businessContext.categories.fine-dining'),
          makeDecision('businessContext.categories.bar'),
        ],
        coreSnapshot,
        gbpSnapshot,
      },
      {
        fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
        identify: (entry) => entry.displayName.toLowerCase().replace(/\s+/g, '-'),
        readCoreList: (snapshot) => snapshot.businessContext.categories,
        readGoogleList: (snapshot) => snapshot.businessContext.categories,
        missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
      },
    );

    expect(plan.supported).toBe(true);
    if (plan.supported) {
      expect(plan.perField).toEqual({});
      expect(plan.exportable.map((entry) => entry.fieldKey)).toEqual([
        'businessContext.categories.fine-dining',
        'businessContext.categories.bar',
      ]);
      expect(plan.merged).toEqual([cafe, fineDining, bar]);
    }
  });

  it('records missing-core list decisions and omits them from exportable entries', () => {
    const plan = planBusinessContextListMergeBatch(
      {
        decisions: [makeDecision('businessContext.categories.missing')],
        coreSnapshot: makeSnapshot(),
        gbpSnapshot: makeSnapshot(),
      },
      {
        fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
        identify: (entry: DualSyncCategoryValue) => entry.displayName,
        readCoreList: (snapshot) => snapshot.businessContext.categories,
        readGoogleList: (snapshot) => snapshot.businessContext.categories,
        missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
      },
    );

    expect(plan.supported).toBe(true);
    if (plan.supported) {
      expect(plan.exportable).toEqual([]);
      expect(plan.perField['businessContext.categories.missing']).toMatchObject({
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'Core snapshot is missing category missing; cannot export.',
          retryable: false,
        },
      });
    }
  });

  it('plans a single list export with merged Google rows and resolved config', () => {
    const coreSnapshot = makeSnapshot({
      businessContext: {
        categories: [fineDining],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });
    const gbpSnapshot = makeSnapshot({
      businessContext: {
        categories: [cafe],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });
    const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });

    const plan = planBusinessContextSingleListExport(
      {
        fieldKey: 'businessContext.categories.fine-dining',
        registry,
        coreSnapshot,
        gbpSnapshot,
      },
      {
        fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
        identify: (entry: DualSyncCategoryValue) =>
          entry.displayName.toLowerCase().replace(/\s+/g, '-'),
        readCoreList: (snapshot) => snapshot.businessContext.categories,
        readGoogleList: (snapshot) => snapshot.businessContext.categories,
        unsupportedMessage: (fieldKey) => `Categories export port does not handle ${fieldKey}.`,
        missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
      },
    );

    expect(plan.status).toBe('ready');
    if (plan.status === 'ready') {
      expect(plan.id).toBe('fine-dining');
      expect(plan.config.fieldKey).toBe('businessContext.categories.fine-dining');
      expect(plan.coreEntry).toBe(fineDining);
      expect(plan.merged).toEqual([cafe, fineDining]);
    }
  });

  it('fails a single list export when the field prefix is unsupported', () => {
    const snapshot = makeSnapshot();
    const registry = buildRegistry({
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      includeCoreOnly: false,
    });

    const plan = planBusinessContextSingleListExport(
      {
        fieldKey: 'profile.name',
        registry,
        coreSnapshot: snapshot,
        gbpSnapshot: snapshot,
      },
      {
        fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
        identify: (entry: DualSyncCategoryValue) => entry.displayName,
        readCoreList: (currentSnapshot) => currentSnapshot.businessContext.categories,
        readGoogleList: (currentSnapshot) => currentSnapshot.businessContext.categories,
        unsupportedMessage: (fieldKey) => `Categories export port does not handle ${fieldKey}.`,
        missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
      },
    );

    expect(plan.status).toBe('failed');
    if (plan.status === 'failed') {
      expect(plan.result).toMatchObject({
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'Categories export port does not handle profile.name.',
        },
      });
    }
  });

  it('fails a single list export when the Core entry is missing', () => {
    const coreSnapshot = makeSnapshot();
    const gbpSnapshot = makeSnapshot({
      businessContext: {
        categories: [bar],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });
    const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });

    const plan = planBusinessContextSingleListExport(
      {
        fieldKey: 'businessContext.categories.bar',
        registry,
        coreSnapshot,
        gbpSnapshot,
      },
      {
        fieldPrefix: BUSINESS_CONTEXT_EXPORT_PREFIX.category,
        identify: (entry: DualSyncCategoryValue) =>
          entry.displayName.toLowerCase().replace(/\s+/g, '-'),
        readCoreList: (snapshot) => snapshot.businessContext.categories,
        readGoogleList: (snapshot) => snapshot.businessContext.categories,
        unsupportedMessage: (fieldKey) => `Categories export port does not handle ${fieldKey}.`,
        missingMessage: (id) => `Core snapshot is missing category ${id}; cannot export.`,
      },
    );

    expect(plan.status).toBe('failed');
    if (plan.status === 'failed') {
      expect(plan.result).toMatchObject({
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'Core snapshot is missing category bar; cannot export.',
          retryable: false,
        },
      });
    }
  });

  it('plans a single attribute export with resolved config', () => {
    const coreSnapshot = makeSnapshot({
      businessContext: {
        categories: [],
        serviceAreas: [],
        attributes: [servesDinner],
        serviceItems: [],
      },
    });
    const gbpSnapshot = makeSnapshot();
    const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });

    const plan = planBusinessContextSingleAttributeExport({
      fieldKey: 'businessContext.attributes.serves_dinner',
      registry,
      coreSnapshot,
    });

    expect(plan.status).toBe('ready');
    if (plan.status === 'ready') {
      expect(plan.attributeKey).toBe('serves_dinner');
      expect(plan.config.fieldKey).toBe('businessContext.attributes.serves_dinner');
      expect(plan.coreEntry).toBe(servesDinner);
    }
  });

  it('plans attribute batches with exportable entries and per-field missing failures', () => {
    const coreSnapshot = makeSnapshot({
      businessContext: {
        categories: [],
        serviceAreas: [],
        attributes: [servesDinner],
        serviceItems: [],
      },
    });

    const plan = planBusinessContextAttributeBatch(
      [
        {
          ...makeDecision('businessContext.attributes.serves_dinner'),
          sectionKey: 'businessContext.attributes',
        },
        {
          ...makeDecision('businessContext.attributes.missing'),
          sectionKey: 'businessContext.attributes',
        },
      ],
      coreSnapshot,
    );

    expect(plan.supported).toBe(true);
    if (plan.supported) {
      expect(plan.exportable).toHaveLength(1);
      expect(plan.exportable[0]?.attributeKey).toBe('serves_dinner');
      expect(plan.perField['businessContext.attributes.missing']).toMatchObject({
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'Core snapshot is missing attribute missing; cannot export.',
        },
      });
    }
  });

  it('resolves registry configs and builds canonical success hashes', () => {
    const coreSnapshot = makeSnapshot({
      businessContext: {
        categories: [fineDining],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });
    const registry = buildRegistry({
      coreSnapshot,
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });

    const configResult = resolveBusinessContextExportFieldConfig(
      registry,
      'businessContext.categories.fine-dining',
    );
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      const result = buildBusinessContextExportSuccess(configResult.config, fineDining);
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.afterCoreHash).toBe(result.afterGbpHash);
        expect(result.afterCoreHash).toEqual(expect.any(String));
      }
    }
  });
});
