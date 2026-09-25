import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GbpDriftProvider } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftProvider';
import { useGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const publishMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const dualSyncState = vi.hoisted(() => ({
  fields: [] as DualSyncFieldSummary[],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({
    data: { status: 'linked' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: {
        fields: dualSyncState.fields,
      },
      isLoading: false,
    },
    publishMutation,
  }),
}));

function valuesForField(fieldKey: string, label: string) {
  if (fieldKey.startsWith('operatingHours.weekly.')) {
    return {
      coreValue: { opensAt: '09:00', closesAt: '17:00', isClosed: false },
      gbpValue: { opensAt: '10:00', closesAt: '17:00', isClosed: false },
    };
  }
  if (fieldKey.startsWith('servicePeriods.')) {
    return {
      coreValue: {
        name: label,
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
      },
      gbpValue: {
        name: label,
        dayOfWeek: 1,
        startTime: '12:30',
        endTime: '15:00',
        bookingOption: 'lunch',
      },
    };
  }
  if (fieldKey.startsWith('businessContext.categories.')) {
    return {
      coreValue: { displayName: label, categoryCode: 'pub', isPrimary: true },
      gbpValue: { displayName: label, categoryCode: 'restaurant', isPrimary: true },
    };
  }
  if (fieldKey.startsWith('businessContext.serviceAreas.')) {
    return {
      coreValue: { displayName: label, areaType: 'city', regionCode: 'GB', placeData: null },
      gbpValue: { displayName: label, areaType: 'postcode', regionCode: 'GB', placeData: null },
    };
  }
  if (fieldKey.startsWith('businessContext.attributes.')) {
    return {
      coreValue: {
        attributeKey: 'wifi',
        valueType: 'BOOL',
        boolValue: true,
        uriValues: [],
        enumValues: [],
        unsetEnumValues: [],
      },
      gbpValue: {
        attributeKey: 'wifi',
        valueType: 'BOOL',
        boolValue: false,
        uriValues: [],
        enumValues: [],
        unsetEnumValues: [],
      },
    };
  }
  if (fieldKey.startsWith('businessContext.serviceItems.')) {
    return {
      coreValue: {
        itemKey: 'delivery',
        itemType: 'delivery',
        displayName: 'Delivery',
        description: 'Local delivery',
        payload: null,
      },
      gbpValue: {
        itemKey: 'delivery',
        itemType: 'delivery',
        displayName: 'Delivery',
        description: 'Collection only',
        payload: null,
      },
    };
  }
  if (fieldKey.startsWith('foodMenus.items.')) {
    return {
      coreValue: {
        stableKey: 'fish',
        itemName: label,
        sectionLabel: 'Mains',
        description: 'Pie',
        basePrice: 13,
        currency: 'GBP',
        dietaryTags: [],
        allergensContains: ['fish'],
      },
      gbpValue: {
        stableKey: 'fish',
        itemName: label,
        sectionLabel: 'Mains',
        description: 'Pie',
        basePrice: 14,
        currency: 'GBP',
        dietaryTags: [],
        allergensContains: ['fish'],
      },
    };
  }
  return {
    coreValue: `${label} in Nabatable`,
    gbpValue: `${label} in Google`,
  };
}

function field(fieldKey: string, sectionKey: DualSyncSectionKey, label: string) {
  const values = valuesForField(fieldKey, label);
  return {
    fieldKey,
    sectionKey,
    kind: 'profile',
    label,
    helpText: `${label} help`,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey,
      sectionKey,
      authority: 'bidirectional_manual',
      riskLevel: 'medium',
      importable: true,
      exportable: true,
      requiresManualReview: false,
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: values.coreValue,
    gbpValue: values.gbpValue,
    coreCanonicalHash: `${fieldKey}:core`,
    gbpCanonicalHash: `${fieldKey}:gbp`,
    capability: {
      canImport: true,
      canExport: true,
      canIgnore: true,
      blockedReasons: [],
    },
    state: 'drifted',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
  } satisfies DualSyncFieldSummary;
}

function OpenDialogButton() {
  const drift = useGbpDrift();
  return (
    <button type="button" onClick={() => drift.openCompare({ filter: 'drifted_only' })}>
      Open compare
    </button>
  );
}

describe('GbpCompareDialog', () => {
  beforeEach(() => {
    publishMutation.mutateAsync.mockReset();
    publishMutation.mutateAsync.mockResolvedValue({ failures: [] });
    dualSyncState.fields = [
      field('profile.name', 'profile', 'Business name'),
      field('operatingHours.weekly.1', 'operatingHours', 'Monday hours'),
      field('servicePeriods.lunch', 'servicePeriods', 'Lunch'),
      field('businessContext.categories.pub', 'businessContext.categories', 'Pub category'),
      field('businessContext.serviceAreas.cambridge', 'businessContext.serviceAreas', 'Cambridge'),
      field('businessContext.attributes.wifi', 'businessContext.attributes', 'Wi-Fi'),
      field('businessContext.serviceItems.delivery', 'businessContext.serviceItems', 'Delivery'),
      field('foodMenus.items.mains.fish', 'foodMenus', 'Fish pie'),
    ];
  });

  it('renders all eight GBP sections returned by the provider', async () => {
    const user = userEvent.setup();
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <OpenDialogButton />
      </GbpDriftProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open compare' }));

    // The dialog module is lazy-loaded on first open.
    const dialog = await screen.findByRole('dialog', { name: 'Compare with Google' });
    for (const label of [
      'Profile',
      'Operating hours',
      'Service periods',
      'Categories',
      'Service areas',
      'Attributes',
      'Service items',
      'Food menus',
    ]) {
      expect(within(dialog).getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
  });

  it('applies all drifted Google fields through the publish contract', async () => {
    const user = userEvent.setup();
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <OpenDialogButton />
      </GbpDriftProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open compare' }));
    await user.click(await screen.findByRole('button', { name: /apply all google fields/i }));

    expect(publishMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        decisions: expect.arrayContaining([
          expect.objectContaining({
            fieldKey: 'profile.name',
            action: 'import_from_google',
            pinnedCoreHash: 'profile.name:core',
            pinnedGbpHash: 'profile.name:gbp',
          }),
          expect.objectContaining({
            fieldKey: 'foodMenus.items.mains.fish',
            sectionKey: 'foodMenus',
          }),
        ]),
      }),
    );
    expect(publishMutation.mutateAsync.mock.calls[0][0].decisions).toHaveLength(8);
  });

  it('moves focus into the lazily loaded dialog and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <OpenDialogButton />
      </GbpDriftProvider>,
    );

    const opener = screen.getByRole('button', { name: 'Open compare' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Compare with Google' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Compare with Google' })).not.toBeInTheDocument(),
    );

    // Re-opening reuses the already-loaded dialog.
    await user.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Compare with Google' })).toBeInTheDocument();
  });
});
