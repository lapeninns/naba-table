import { describe, expect, it } from 'vitest';

import {
  normalizeBusinessContextRowsForComparison,
  providerValueChangedForStaleCheck,
} from '@/server/google-business-profile/workflowBusinessContextComparison';

describe('google business profile workflow business-context comparison helpers', () => {
  it('omits row metadata and sorts rows before comparison', () => {
    expect(
      normalizeBusinessContextRowsForComparison('businessContext.serviceAreas', [
        {
          id: 'provider-2',
          displayName: 'Girton',
          areaType: 'place',
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-28T16:00:00.000Z',
        },
        {
          id: 'provider-1',
          displayName: 'Cambridge',
          areaType: 'place',
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-28T16:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        areaType: 'place',
        displayName: 'Cambridge',
      },
      {
        areaType: 'place',
        displayName: 'Girton',
      },
    ]);
  });

  it('treats category primary flags as non-semantic during workflow comparison', () => {
    expect(
      normalizeBusinessContextRowsForComparison('businessContext.categories', [
        {
          displayName: 'Pub',
          categoryCode: 'gcid:pub',
          isPrimary: true,
        },
      ]),
    ).toEqual([
      {
        categoryCode: 'gcid:pub',
        displayName: 'Pub',
      },
    ]);
  });

  it('ignores metadata-only stale-check changes but detects visible provider changes', () => {
    const baseItem = {
      sectionKey: 'businessContext.attributes',
      providerValue: [
        {
          id: 'before',
          attributeKey: 'serves_beer',
          displayName: 'Serves beer',
          boolValue: true,
          source: 'gbp',
          managedBy: 'provider',
          updatedAt: '2026-04-28T15:00:00.000Z',
        },
      ],
    };

    expect(
      providerValueChangedForStaleCheck(baseItem, {
        ...baseItem,
        providerValue: [
          {
            ...(baseItem.providerValue[0] as Record<string, unknown>),
            id: 'after',
            updatedAt: '2026-04-28T16:00:00.000Z',
          },
        ],
      }),
    ).toBe(false);

    expect(
      providerValueChangedForStaleCheck(baseItem, {
        ...baseItem,
        providerValue: [
          {
            ...(baseItem.providerValue[0] as Record<string, unknown>),
            attributeKey: 'serves_wine',
            displayName: 'Serves wine',
          },
        ],
      }),
    ).toBe(true);
  });
});
