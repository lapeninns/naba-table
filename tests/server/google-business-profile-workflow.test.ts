import { describe, expect, it } from 'vitest';

import {
  googleBusinessProfileWorkflowTestUtils,
  type GoogleBusinessProfileWorkflowDraft,
} from '@/server/google-business-profile/workflow';

import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';

function buildSelectedBusinessContextDraft(): GoogleBusinessProfileWorkflowDraft {
  return {
    sectionDiffs: [
      {
        sectionKey: 'businessContext.categories',
        items: [
          {
            sectionKey: 'businessContext.categories',
            fieldKey: 'businessContext.categories',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
      {
        sectionKey: 'businessContext.serviceAreas',
        items: [
          {
            sectionKey: 'businessContext.serviceAreas',
            fieldKey: 'businessContext.serviceAreas',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
      {
        sectionKey: 'businessContext.attributes',
        items: [
          {
            sectionKey: 'businessContext.attributes',
            fieldKey: 'businessContext.attributes',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
      {
        sectionKey: 'businessContext.serviceItems',
        items: [
          {
            sectionKey: 'businessContext.serviceItems',
            fieldKey: 'businessContext.serviceItems',
            selected: true,
            canPublishToNabatable: true,
          },
        ],
      },
    ],
  } as GoogleBusinessProfileWorkflowDraft;
}

describe('google business profile approval workflow helpers', () => {
  it('rejects draft edits and publishes for terminal or system-owned states', () => {
    expect(() => googleBusinessProfileWorkflowTestUtils.assertDraftEditable('published')).toThrow(
      /cannot be changed/i,
    );
    expect(() => googleBusinessProfileWorkflowTestUtils.assertDraftEditable('archived')).toThrow(
      /cannot be changed/i,
    );
    expect(() => googleBusinessProfileWorkflowTestUtils.assertDraftPublishable('stale')).toThrow(
      /cannot be applied/i,
    );
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertDraftPublishable('publishing'),
    ).toThrow(/cannot be applied/i);

    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertDraftEditable('failed'),
    ).not.toThrow();
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertDraftPublishable('partially_published'),
    ).not.toThrow();
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertDraftPublishable('approved'),
    ).not.toThrow();
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertDraftPublishable('failed'),
    ).not.toThrow();
  });

  it('throws GBP_DRAFT_NOT_APPROVED when publishing a draft still in review_ready', () => {
    let captured: Error | null = null;
    try {
      googleBusinessProfileWorkflowTestUtils.assertDraftPublishable('review_ready');
    } catch (error) {
      captured = error as Error;
    }
    expect(captured).not.toBeNull();
    expect(captured?.name).toBe('GBP_DRAFT_NOT_APPROVED');
    expect(captured?.message).toMatch(/review and approve.*before applying/i);
  });

  it('clones publishable provider business-context rows into core-safe rows', () => {
    const payload = googleBusinessProfileWorkflowTestUtils.businessContextPayloadForDraft(
      buildSelectedBusinessContextDraft(),
      {
        core: {
          categories: [],
          serviceAreas: [],
          attributes: [],
          serviceItems: [],
        },
        providerSnapshot: {
          categories: [
            {
              id: 'provider-category-id',
              displayName: 'Pub',
              categoryCode: 'gcid:pub',
              moreHoursTypes: [],
              isPrimary: true,
              source: 'gbp',
              managedBy: 'provider',
              updatedAt: '2026-04-25T09:50:00.000Z',
            },
          ],
          serviceAreas: [
            {
              id: 'provider-service-area-id',
              displayName: 'Cambridge',
              areaType: 'region',
              regionCode: 'GB',
              googlePlaceId: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
              googlePlaceResourceName: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
              placeData: null,
              source: 'gbp',
              managedBy: 'provider',
              updatedAt: '2026-04-25T09:50:00.000Z',
            },
          ],
          attributes: [
            {
              id: 'provider-attribute-id',
              attributeGroup: 'Accessibility',
              attributeKey: 'has_wheelchair_accessible_entrance',
              attributeName: null,
              attributeId: 'has_wheelchair_accessible_entrance',
              displayName: 'Wheelchair accessible entrance',
              displayText: null,
              displayTextStandalone: null,
              displayTextNegative: null,
              valueType: 'boolean',
              boolValue: true,
              textValue: null,
              uriValue: null,
              uriValues: [],
              enumValues: [],
              unsetEnumValues: [],
              rawValue: { boolValue: true },
              rawEnumValues: null,
              displayValue: { displayText: 'Wheelchair accessible entrance' },
              valueMetadata: [],
              source: 'gbp',
              managedBy: 'provider',
              updatedAt: '2026-04-25T09:50:00.000Z',
            },
          ],
          serviceItems: [
            {
              id: 'provider-service-item-id',
              itemKey: 'private_dining',
              itemType: 'structured',
              displayName: 'Private dining',
              description: null,
              payload: null,
              source: 'gbp',
              managedBy: 'provider',
              updatedAt: '2026-04-25T09:50:00.000Z',
            },
          ],
        },
      } satisfies RestaurantBusinessContextSnapshot,
    );

    expect(payload.categories?.[0]).toMatchObject({
      displayName: 'Pub',
      categoryCode: 'gcid:pub',
      isPrimary: false,
    });
    expect(payload.categories?.[0]).not.toHaveProperty('id');
    expect(payload.serviceAreas?.[0]).not.toHaveProperty('id');
    expect(payload.attributes?.[0]).toMatchObject({
      attributeKey: 'has_wheelchair_accessible_entrance',
      valueType: 'boolean',
      boolValue: true,
    });
    expect(payload.attributes?.[0]).not.toHaveProperty('id');
    expect(payload.serviceItems?.[0]).not.toHaveProperty('id');
  });

  it('treats provider/core business-context row metadata as non-semantic', () => {
    const sections = [
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.categories',
        'Categories',
        [
          {
            id: 'core-category-id',
            displayName: 'Pub',
            categoryCode: 'gcid:pub',
            moreHoursTypes: [],
            isPrimary: false,
            source: 'nabatable',
            managedBy: 'nabatable',
            updatedAt: '2026-04-26T14:15:00.000Z',
          },
        ],
        [
          {
            id: 'provider-category-id',
            displayName: 'Pub',
            categoryCode: 'gcid:pub',
            moreHoursTypes: [],
            isPrimary: true,
            source: 'gbp',
            managedBy: 'gbp',
            updatedAt: '2026-04-26T14:10:00.000Z',
          },
        ],
        false,
      ),
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.serviceAreas',
        'Service areas',
        [
          {
            id: 'core-service-area-id',
            displayName: 'Cambridge',
            areaType: 'place',
            regionCode: 'GB',
            placeData: { placeId: 'cambridge' },
            source: 'nabatable',
            managedBy: 'nabatable',
            updatedAt: '2026-04-26T14:15:00.000Z',
          },
        ],
        [
          {
            id: 'provider-service-area-id',
            displayName: 'Cambridge',
            areaType: 'place',
            regionCode: 'GB',
            placeData: { placeId: 'cambridge' },
            source: 'gbp',
            managedBy: 'gbp',
            updatedAt: '2026-04-26T14:10:00.000Z',
          },
        ],
        false,
      ),
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.attributes',
        'Attributes',
        [
          {
            id: 'core-attribute-id',
            attributeGroup: 'Accessibility',
            attributeKey: 'has_wheelchair_accessible_entrance',
            displayName: 'Wheelchair accessible entrance',
            valueType: 'boolean',
            boolValue: true,
            source: 'nabatable',
            managedBy: 'nabatable',
            updatedAt: '2026-04-26T14:15:00.000Z',
          },
        ],
        [
          {
            id: 'provider-attribute-id',
            attributeGroup: 'Accessibility',
            attributeKey: 'has_wheelchair_accessible_entrance',
            displayName: 'Wheelchair accessible entrance',
            valueType: 'boolean',
            boolValue: true,
            source: 'gbp',
            managedBy: 'gbp',
            updatedAt: '2026-04-26T14:10:00.000Z',
          },
        ],
        false,
      ),
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.serviceItems',
        'Service items',
        [
          {
            id: 'core-service-item-id',
            itemKey: 'private_dining',
            itemType: 'structured',
            displayName: 'Private dining',
            description: null,
            payload: { available: true },
            source: 'nabatable',
            managedBy: 'nabatable',
            updatedAt: '2026-04-26T14:15:00.000Z',
          },
        ],
        [
          {
            id: 'provider-service-item-id',
            itemKey: 'private_dining',
            itemType: 'structured',
            displayName: 'Private dining',
            description: null,
            payload: { available: true },
            source: 'gbp',
            managedBy: 'gbp',
            updatedAt: '2026-04-26T14:10:00.000Z',
          },
        ],
        false,
      ),
    ];

    for (const section of sections) {
      expect(section.status).toBe('unchanged');
      expect(section.summary).toBe('No Google changes need review in this section.');
      expect(section.items[0]).toMatchObject({
        status: 'unchanged',
        selected: false,
      });
    }
  });

  it('keeps visible business-context value changes as approval items', () => {
    const sections = [
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.categories',
        'Categories',
        [{ displayName: 'Restaurant', categoryCode: 'gcid:restaurant' }],
        [{ displayName: 'Pub', categoryCode: 'gcid:pub' }],
        false,
      ),
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.serviceAreas',
        'Service areas',
        [{ displayName: 'Cambridge', areaType: 'place', regionCode: 'GB' }],
        [{ displayName: 'Girton', areaType: 'place', regionCode: 'GB' }],
        false,
      ),
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.attributes',
        'Attributes',
        [
          {
            attributeKey: 'outdoor_seating',
            valueType: 'boolean',
            boolValue: false,
          },
        ],
        [
          {
            attributeKey: 'outdoor_seating',
            valueType: 'boolean',
            boolValue: true,
          },
        ],
        false,
      ),
      googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
        'businessContext.serviceItems',
        'Service items',
        [{ itemKey: 'private_dining', displayName: 'Private dining' }],
        [{ itemKey: 'private_dining', displayName: 'Private dining room' }],
        false,
      ),
    ];

    for (const section of sections) {
      expect(section.status).toBe('ready');
      expect(section.summary).toBe('1 change ready to review.');
      expect(section.items[0]).toMatchObject({
        status: 'ready',
        selected: true,
      });
    }
  });

  it('allows clearing local business-context rows when Google has no matching rows', () => {
    const section = googleBusinessProfileWorkflowTestUtils.buildBusinessContextSection(
      'businessContext.attributes',
      'Attributes',
      [
        {
          attributeKey: 'outdoor_seating',
          valueType: 'boolean',
          boolValue: true,
        },
      ],
      [],
      false,
    );

    expect(section).toMatchObject({
      status: 'ready',
      canPublishToNabatable: false,
      blockedReasons: [],
    });
    expect(section.items[0]).toMatchObject({
      status: 'ready',
      selected: false,
      canPublishToNabatable: true,
      canPushToGoogle: false,
      providerValue: [],
    });
  });

  it('shows local-only service periods so they can be created in Google or removed locally', () => {
    const section = googleBusinessProfileWorkflowTestUtils.buildServicePeriodsSection(
      {
        servicePeriods: [
          {
            name: 'Lunch',
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '15:00',
            bookingOption: 'lunch',
          },
        ],
      } as never,
      {
        coreNormalization: {
          servicePeriods: {
            periods: [],
            warnings: [],
          },
        },
      } as never,
      true,
    );

    expect(section.items).toHaveLength(1);
    expect(section.items[0]).toMatchObject({
      fieldKey: 'servicePeriods.1.lunch',
      status: 'ready',
      selected: false,
      currentValue: 'Lunch 12:00-15:00',
      providerValue: null,
      canPublishToNabatable: true,
      canPushToGoogle: true,
    });
  });

  it('classifies Google push errors without preserving token values', () => {
    expect(
      googleBusinessProfileWorkflowTestUtils.classifyGoogleBusinessProfilePushError({
        status: 429,
        message: 'Quota exceeded for access_token=secret-token',
      }),
    ).toEqual({
      classification: 'quota',
      message: 'Quota exceeded for access_token=[redacted]',
    });

    expect(
      googleBusinessProfileWorkflowTestUtils.classifyGoogleBusinessProfilePushError({
        status: 403,
        message: 'Permission denied',
      }).classification,
    ).toBe('permission');
    expect(
      googleBusinessProfileWorkflowTestUtils.classifyGoogleBusinessProfilePushError(
        new Error('Unsupported update mask: moreHours'),
      ).classification,
    ).toBe('unsupported_field');
  });

  it('marks a Nabatable-only special-hours override as ready for Google update', () => {
    const section = googleBusinessProfileWorkflowTestUtils.buildOperatingHoursSection(
      {
        operatingHours: {
          weekly: [],
          overrides: [
            {
              effectiveDate: '2026-06-02',
              opensAt: '12:00',
              closesAt: '22:30',
              isClosed: false,
            },
          ],
        },
      } as never,
      {
        coreNormalization: {
          operatingHours: {
            weekly: [],
            overrides: [],
            warnings: [],
          },
        },
      } as never,
    );

    expect(section.items).toHaveLength(1);
    expect(section.items[0]).toMatchObject({
      fieldKey: 'operatingHours.override.2026-06-02',
      status: 'ready',
      selected: false,
      currentValue: '12:00-22:30',
      providerValue: null,
      proposedValue: '12:00-22:30',
      canPublishToNabatable: true,
      canPushToGoogle: true,
    });
  });

  it('keeps published reviews read-only even when current data has later drift', () => {
    const draft = {
      id: 'draft-published',
      status: 'published',
      fetchedAt: '2026-04-28T10:00:00.000Z',
      approvedAt: '2026-04-28T10:05:00.000Z',
      publishedAt: '2026-04-28T10:06:00.000Z',
      staleSections: [],
      conflictMetadata: {},
      selectedApprovals: {
        'operatingHours.override.2026-06-02': true,
      },
      sourceSnapshotRefs: {},
      coreSnapshotHashes: {},
      sectionDiffs: [
        {
          sectionKey: 'operatingHours',
          label: 'Operating hours and special hours',
          status: 'ready',
          summary: '1 change ready to review.',
          canPublishToNabatable: false,
          canPushToGoogle: true,
          blockedReasons: ['Special hours 2026-06-02 cannot update Nabatable from here yet.'],
          items: [
            {
              sectionKey: 'operatingHours',
              fieldKey: 'operatingHours.override.2026-06-02',
              label: 'Special hours 2026-06-02',
              status: 'ready',
              selected: true,
              currentValue: '12:00-22:30',
              providerValue: null,
              proposedValue: '12:00-22:30',
              direction: 'pull_from_gbp',
              canPublishToNabatable: false,
              canPushToGoogle: true,
              warnings: [],
            },
          ],
        },
      ],
      createdAt: '2026-04-28T10:00:00.000Z',
      updatedAt: '2026-04-28T10:06:00.000Z',
    } satisfies GoogleBusinessProfileWorkflowDraft;

    const readOnly = googleBusinessProfileWorkflowTestUtils.suppressActionsForReadOnlyReview(draft);

    expect(readOnly.selectedApprovals['operatingHours.override.2026-06-02']).toBe(false);
    expect(readOnly.sectionDiffs[0]).toMatchObject({
      status: 'unchanged',
      canPublishToNabatable: false,
      blockedReasons: [],
    });
    expect(readOnly.sectionDiffs[0].items[0]).toMatchObject({
      status: 'unchanged',
      selected: false,
    });
  });

  it('clears only selected Nabatable-managed profile projection rows after pulling Google values', () => {
    expect(
      googleBusinessProfileWorkflowTestUtils.profileProjectionCleanupTargets([
        'contactPhone',
        'address',
        'googleMapUrl',
      ]),
    ).toEqual([
      {
        table: 'restaurant_phone_numbers',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
        },
        anyOf: {
          phone_kind: 'primary',
          is_primary: true,
        },
      },
      {
        table: 'restaurant_addresses',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
        },
        anyOf: {
          address_type: 'storefront',
          is_primary: true,
        },
      },
      {
        table: 'restaurant_links',
        filters: {
          source: 'nabatable',
          managed_by: 'nabatable',
          link_type: 'google_map',
          link_status: 'current',
        },
      },
    ]);
  });

  it('ignores volatile business-context row metadata when checking provider staleness', () => {
    const baseItem = {
      sectionKey: 'businessContext.attributes',
      fieldKey: 'businessContext.attributes',
      label: 'Attributes',
      currentValue: [],
      providerValue: [
        {
          id: 'before-sync-row-id',
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: '2026-04-28T15:49:03.490Z',
          attributeKey: 'serves_beer',
          attributeName: 'attributes/serves_beer',
          displayText: 'Serves Beer',
          valueType: 'boolean',
          boolValue: null,
          textValue: null,
          uriValue: null,
          uriValues: [],
          enumValues: [],
          unsetEnumValues: [],
        },
      ],
      proposedValue: [],
      direction: 'pull_from_gbp',
      status: 'ready',
      selected: true,
      canPublishToNabatable: true,
      canPushToGoogle: false,
      warnings: [],
    } satisfies GoogleBusinessProfileWorkflowDraft['sectionDiffs'][number]['items'][number];

    expect(
      googleBusinessProfileWorkflowTestUtils.providerValueChangedForStaleCheck(baseItem, {
        ...baseItem,
        providerValue: [
          {
            ...(baseItem.providerValue[0] as Record<string, unknown>),
            id: 'after-sync-row-id',
            updatedAt: '2026-04-28T16:00:37.642Z',
          },
        ],
      }),
    ).toBe(false);

    expect(
      googleBusinessProfileWorkflowTestUtils.providerValueChangedForStaleCheck(baseItem, {
        ...baseItem,
        providerValue: [
          {
            ...(baseItem.providerValue[0] as Record<string, unknown>),
            id: 'after-sync-row-id',
            attributeKey: 'serves_wine',
            attributeName: 'attributes/serves_wine',
            displayText: 'Serves Wine',
            updatedAt: '2026-04-28T16:00:37.642Z',
          },
        ],
      }),
    ).toBe(true);
  });

  it('only includes Google masks for selected fields that can push to Google', () => {
    const masks = googleBusinessProfileWorkflowTestUtils.googleMasksForDraft({
      sectionDiffs: [
        {
          sectionKey: 'profile',
          items: [
            {
              sectionKey: 'profile',
              fieldKey: 'profile.name',
              selected: true,
              canPublishToNabatable: true,
              canPushToGoogle: true,
            },
            {
              sectionKey: 'profile',
              fieldKey: 'profile.address',
              selected: true,
              canPublishToNabatable: true,
              canPushToGoogle: false,
            },
          ],
        },
        {
          sectionKey: 'servicePeriods',
          items: [
            {
              sectionKey: 'servicePeriods',
              fieldKey: 'servicePeriods.2.dinner',
              selected: true,
              canPublishToNabatable: true,
              canPushToGoogle: false,
            },
          ],
        },
      ],
    } as GoogleBusinessProfileWorkflowDraft);

    expect(masks).toEqual(['title']);
  });

  it('blocks Google push when the linked profile is not enabled for push', () => {
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertGooglePushEnabled({ push_enabled: false }),
    ).toThrow(/google writes are disabled/i);
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertGooglePushEnabled({ push_enabled: true }),
    ).not.toThrow();
  });

  it('supports reviewed Google-to-Nabatable and Nabatable-to-Google publish directions', () => {
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertApprovalWorkflowDirectionSupported(
        'google_to_nabatable',
      ),
    ).not.toThrow();
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertApprovalWorkflowDirectionSupported(
        'google_to_nabatable_with_google_sync',
      ),
    ).not.toThrow();
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.assertApprovalWorkflowDirectionSupported(
        'nabatable_to_google',
      ),
    ).not.toThrow();
  });

  it('normalizes publish direction intent while preserving the legacy push flag', () => {
    expect(
      googleBusinessProfileWorkflowTestUtils.normalizePublishDirectionIntent({
        directionIntent: 'google_to_nabatable',
      }),
    ).toBe('google_to_nabatable');
    expect(
      googleBusinessProfileWorkflowTestUtils.normalizePublishDirectionIntent({
        pushToGoogle: true,
      }),
    ).toBe('google_to_nabatable_with_google_sync');
    expect(() =>
      googleBusinessProfileWorkflowTestUtils.normalizePublishDirectionIntent({
        directionIntent: 'google_to_nabatable',
        pushToGoogle: true,
      }),
    ).toThrow(/conflicts/i);
    expect(
      googleBusinessProfileWorkflowTestUtils.publishModeForDirectionIntent(
        'google_to_nabatable_with_google_sync',
      ),
    ).toBe('nabatable_and_google');
    expect(
      googleBusinessProfileWorkflowTestUtils.publishModeForDirectionIntent('nabatable_to_google'),
    ).toBe('google_only');
    expect(
      googleBusinessProfileWorkflowTestUtils.directionIntentForPublishMode('nabatable_only'),
    ).toBe('google_to_nabatable');
    expect(
      googleBusinessProfileWorkflowTestUtils.directionIntentForPublishMode('google_only'),
    ).toBe('nabatable_to_google');
  });

  it('reconciles a saved draft with current values so manually resolved drift is no longer publishable', () => {
    const draft = {
      id: 'draft-old',
      status: 'review_ready',
      fetchedAt: '2026-04-28T10:00:00.000Z',
      approvedAt: null,
      publishedAt: null,
      staleSections: [],
      conflictMetadata: {},
      selectedApprovals: {
        'profile.name': true,
      },
      sourceSnapshotRefs: {},
      coreSnapshotHashes: {},
      sectionDiffs: [
        {
          sectionKey: 'profile',
          label: 'Profile, contact and links',
          status: 'ready',
          summary: '1 change ready to review.',
          canPublishToNabatable: true,
          canPushToGoogle: true,
          blockedReasons: [],
          items: [
            {
              sectionKey: 'profile',
              fieldKey: 'profile.name',
              label: 'Business name',
              status: 'ready',
              selected: true,
              currentValue: 'Old Crown Drift',
              providerValue: 'Old Crown',
              proposedValue: 'Old Crown',
              direction: 'pull_from_gbp',
              canPublishToNabatable: true,
              canPushToGoogle: true,
              warnings: [],
            },
          ],
        },
      ],
      createdAt: '2026-04-28T10:00:00.000Z',
      updatedAt: '2026-04-28T10:00:00.000Z',
    } satisfies GoogleBusinessProfileWorkflowDraft;

    const reconciled = googleBusinessProfileWorkflowTestUtils.reconcileDraftWithCurrentSections(
      draft,
      [
        {
          sectionKey: 'profile',
          label: 'Profile, contact and links',
          status: 'unchanged',
          summary: 'No Google changes need review in this section.',
          canPublishToNabatable: false,
          canPushToGoogle: true,
          blockedReasons: [],
          items: [
            {
              sectionKey: 'profile',
              fieldKey: 'profile.name',
              label: 'Business name',
              status: 'unchanged',
              selected: false,
              currentValue: 'Old Crown',
              providerValue: 'Old Crown',
              proposedValue: 'Old Crown',
              direction: 'pull_from_gbp',
              canPublishToNabatable: true,
              canPushToGoogle: true,
              warnings: [],
            },
          ],
        },
      ],
    );

    expect(reconciled.sectionDiffs[0]).toMatchObject({
      status: 'unchanged',
      summary: 'No Google changes need review in this section.',
      canPublishToNabatable: false,
    });
    expect(reconciled.sectionDiffs[0].items[0]).toMatchObject({
      status: 'unchanged',
      selected: false,
      currentValue: 'Old Crown',
      providerValue: 'Old Crown',
    });
  });
});
