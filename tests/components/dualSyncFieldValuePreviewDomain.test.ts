import { describe, expect, it } from 'vitest';

import {
  formatDualSyncFieldLabel,
  formatDualSyncFieldPreview,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncFieldValuePreviewDomain';

describe('dualSyncFieldValuePreviewDomain', () => {
  it('formats preview values without leaking nullish or empty values into the UI', () => {
    expect(formatDualSyncFieldPreview(null)).toBe('—');
    expect(formatDualSyncFieldPreview(undefined)).toBe('—');
    expect(formatDualSyncFieldPreview('')).toBe('—');
    expect(formatDualSyncFieldPreview('Nabatable')).toBe('Nabatable');
    expect(formatDualSyncFieldPreview(12)).toBe('12');
    expect(formatDualSyncFieldPreview(false)).toBe('No');
    expect(formatDualSyncFieldPreview({ city: 'Cambridge' })).toBe('City: Cambridge');
  });

  it('handles cyclic values without exposing object coercion or crashing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(formatDualSyncFieldPreview(circular)).toBe('Self: Unavailable');
  });

  it('shows opening hours, closed days and missing times honestly', () => {
    expect(
      formatDualSyncFieldPreview({ opensAt: '12:00', closesAt: '23:00', isClosed: false }),
    ).toBe('12:00–23:00');
    expect(formatDualSyncFieldPreview({ opensAt: null, closesAt: null, isClosed: true })).toBe(
      'Closed',
    );
    expect(
      formatDualSyncFieldPreview({ opensAt: '18:00', closesAt: '02:00', isClosed: false }),
    ).toBe('18:00–02:00 (next day)');
    expect(formatDualSyncFieldPreview({ opensAt: null, closesAt: null, isClosed: false })).toBe(
      'Hours not set',
    );
  });

  it('shows meal periods without exposing their stable keys', () => {
    expect(
      formatDualSyncFieldPreview({
        stableKey: '0|12:00|17:00|lunch|lunch',
        name: 'Lunch',
        dayOfWeek: 0,
        startTime: '12:00',
        endTime: '17:00',
        bookingOption: 'lunch',
      }),
    ).toBe('Lunch · Sunday · 12:00–17:00 · Booking option: Lunch');
  });

  it('shows category priority and service area country', () => {
    expect(
      formatDualSyncFieldPreview({
        displayName: 'Nepalese restaurant',
        categoryCode: 'gcid:nepalese_restaurant',
        moreHoursTypes: [],
        isPrimary: true,
      }),
    ).toBe('Nepalese restaurant · Primary category');
    expect(
      formatDualSyncFieldPreview({
        displayName: 'Cambridge',
        areaType: 'place',
        regionCode: 'GB',
        placeData: { placeId: 'abc' },
      }),
    ).toBe('Cambridge · GB');
  });

  it('distinguishes false, unknown and explicitly excluded attribute values', () => {
    expect(
      formatDualSyncFieldPreview({
        attributeKey: 'has_live_music',
        valueType: 'boolean',
        boolValue: false,
      }),
    ).toBe('No');
    expect(
      formatDualSyncFieldPreview({
        attributeKey: 'has_live_music',
        valueType: 'boolean',
        boolValue: null,
      }),
    ).toBe('Not set');
    expect(
      formatDualSyncFieldPreview({
        attributeKey: 'wi_fi',
        valueType: 'enum',
        enumValues: ['free_wi_fi'],
        unsetEnumValues: ['paid_wi_fi'],
      }),
    ).toBe('Free Wi-Fi · Not offered: Paid Wi-Fi');
    expect(
      formatDualSyncFieldPreview({
        attributeKey: 'url_menu',
        valueType: 'uri',
        uriValues: ['https://example.com/menu'],
      }),
    ).toBe('https://example.com/menu');
  });

  it('keeps all menu information including zero prices and allergens', () => {
    const menu = Object.freeze({
      stableKey: 'item-1',
      itemName: 'Tea',
      sectionLabel: 'Drinks',
      description: 'Mint',
      basePrice: 0,
      currency: 'GBP',
      dietaryTags: ['vegan'],
      allergensContains: ['milk'],
      googlePath: null,
    });
    const preview = formatDualSyncFieldPreview(menu);
    expect(preview).toContain('Tea');
    expect(preview).toContain('GBP 0.00');
    expect(preview).toContain('Allergens: Milk');
    expect(preview).toContain('Dietary tags: Vegan');
    expect(menu.basePrice).toBe(0);
  });

  it('formats nested unknown structures and empty lists without JSON', () => {
    expect(formatDualSyncFieldPreview([])).toBe('None');
    expect(formatDualSyncFieldPreview({ price: { amount: 0 }, active: false })).toBe(
      'Price: Amount: 0 · Active: No',
    );
    expect(formatDualSyncFieldPreview(['First', 'Second'])).toBe('First; Second');
  });

  it('gives provider attribute identifiers readable labels without changing ordinary names', () => {
    expect(formatDualSyncFieldLabel('attributes/has_live_music')).toBe('Live music');
    expect(formatDualSyncFieldLabel('attributes/pay_credit_card')).toBe('Accepts credit card');
    expect(formatDualSyncFieldLabel('attributes/wi_fi')).toBe('Wi-Fi');
    expect(formatDualSyncFieldLabel('has_live_music', 'businessContext.attributes')).toBe(
      'Live music',
    );
    expect(formatDualSyncFieldLabel('wi_fi', 'businessContext.attributes')).toBe('Wi-Fi');
    expect(formatDualSyncFieldLabel('has_live_music', 'profile')).toBe('has_live_music');
    expect(formatDualSyncFieldLabel('Old Crown Girton')).toBe('Old Crown Girton');
  });
});
