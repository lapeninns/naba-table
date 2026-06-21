import { describe, expect, it } from 'vitest';

import {
  applyServicePeriodsBatchFailure,
  buildServicePeriodsExportSuccess,
  parseServicePeriodExportStableKey,
  planServicePeriodsExportBatch,
  resolveServicePeriodExportDecision,
  resolveServicePeriodsExportFieldConfig,
} from '@/server/dual-sync/publish/ports/service-periods-export-domain';
import { buildRegistry } from '@/server/dual-sync/registry';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

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
    sectionKey: 'servicePeriods',
    action: 'export_to_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
  };
}

const mondayDinner = {
  stableKey: '1|17:00:00|22:00:00|dining|dinner',
  name: 'Monday Dinner',
  dayOfWeek: 1,
  startTime: '17:00:00',
  endTime: '22:00:00',
  bookingOption: 'dining' as const,
};

const googleOnlyWednesday = {
  stableKey: '3|17:00:00|22:00:00|dining|dinner',
  name: 'Wednesday Dinner',
  dayOfWeek: 3,
  startTime: '17:00:00',
  endTime: '22:00:00',
  bookingOption: 'dining' as const,
};

describe('service-periods export domain helpers', () => {
  it('parses only populated service-period field-key tails', () => {
    expect(parseServicePeriodExportStableKey(`servicePeriods.${mondayDinner.stableKey}`)).toBe(
      mondayDinner.stableKey,
    );
    expect(parseServicePeriodExportStableKey('profile.name')).toBeNull();
    expect(parseServicePeriodExportStableKey('servicePeriods.')).toBeNull();
  });

  it('resolves export decisions with Core weekday priority and Google weekday fallback', () => {
    expect(
      resolveServicePeriodExportDecision({
        fieldKey: `servicePeriods.${mondayDinner.stableKey}`,
        coreSnapshot: makeSnapshot({ servicePeriods: { periods: [mondayDinner] } }),
        gbpSnapshot: makeSnapshot(),
      }),
    ).toMatchObject({
      supported: true,
      resolved: {
        stableKey: mondayDinner.stableKey,
        dayOfWeek: 1,
        corePeriod: mondayDinner,
      },
    });

    expect(
      resolveServicePeriodExportDecision({
        fieldKey: `servicePeriods.${googleOnlyWednesday.stableKey}`,
        coreSnapshot: makeSnapshot({
          servicePeriods: {
            periods: [{ ...googleOnlyWednesday, dayOfWeek: null }],
          },
        }),
        gbpSnapshot: makeSnapshot({ servicePeriods: { periods: [googleOnlyWednesday] } }),
      }),
    ).toMatchObject({
      supported: true,
      resolved: {
        stableKey: googleOnlyWednesday.stableKey,
        dayOfWeek: 3,
      },
    });
  });

  it('plans batch exports with missing-core and weekday-less per-field failures', () => {
    const allWeek = {
      stableKey: 'any|17:00:00|22:00:00|dining|all-week',
      name: 'All Week',
      dayOfWeek: null,
      startTime: '17:00:00',
      endTime: '22:00:00',
      bookingOption: 'dining' as const,
    };

    const plan = planServicePeriodsExportBatch({
      decisions: [
        makeDecision(`servicePeriods.${mondayDinner.stableKey}`),
        makeDecision(`servicePeriods.${allWeek.stableKey}`),
        makeDecision('servicePeriods.missing'),
      ],
      coreSnapshot: makeSnapshot({ servicePeriods: { periods: [mondayDinner, allWeek] } }),
      gbpSnapshot: makeSnapshot(),
    });

    expect(plan.supported).toBe(true);
    if (plan.supported) {
      expect(plan.dayOfWeeks).toEqual([1]);
      expect(plan.exportable.map((entry) => entry.fieldKey)).toEqual([
        `servicePeriods.${mondayDinner.stableKey}`,
      ]);
      expect(plan.perField[`servicePeriods.${allWeek.stableKey}`]).toMatchObject({
        status: 'failed',
        failure: { code: 'UNSUPPORTED_FIELD' },
      });
      expect(plan.perField['servicePeriods.missing']).toMatchObject({
        status: 'failed',
        failure: { code: 'PORT_FAILURE', retryable: true },
      });
    }
  });

  it('builds retryable batch failure results for exportable decisions', () => {
    expect(
      applyServicePeriodsBatchFailure(
        {},
        [{ fieldKey: `servicePeriods.${mondayDinner.stableKey}` }],
        'Service-periods batch export failed: boom',
      ),
    ).toEqual({
      [`servicePeriods.${mondayDinner.stableKey}`]: {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'Service-periods batch export failed: boom',
          retryable: true,
        },
      },
    });
  });

  it('resolves registry configs and builds canonical success hashes', () => {
    const coreSnapshot = makeSnapshot({ servicePeriods: { periods: [mondayDinner] } });
    const registry = buildRegistry({
      coreSnapshot,
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });

    const configResult = resolveServicePeriodsExportFieldConfig(
      registry,
      `servicePeriods.${mondayDinner.stableKey}`,
    );
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      const result = buildServicePeriodsExportSuccess(configResult.config, mondayDinner);
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.afterCoreHash).toBe(result.afterGbpHash);
        expect(result.afterCoreHash).toEqual(expect.any(String));
      }
    }
  });
});
