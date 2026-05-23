import { describe, expect, it } from 'vitest';

import {
  getServiceItemRowTitle,
  SERVICE_ITEM_MAIN_FIELDS,
} from '@/components/features/restaurant-settings/discovery/panels/serviceItemsPanelDomain';

import type { ServiceItemEditor } from '@/components/features/restaurant-settings/businessContextModel';

const buildServiceItem = (overrides: Partial<ServiceItemEditor> = {}): ServiceItemEditor => ({
  id: 'service-item-1',
  itemKey: 'delivery',
  itemType: 'fulfillment',
  displayName: 'Delivery',
  description: 'Local delivery',
  payloadJson: '{}',
  ...overrides,
});

describe('serviceItemsPanelDomain', () => {
  it('keeps service-item field specs stable', () => {
    expect(SERVICE_ITEM_MAIN_FIELDS.map((field) => field.field)).toEqual([
      'itemKey',
      'itemType',
      'displayName',
      'description',
    ]);
  });

  it('derives row titles from display name, item key, then fallback', () => {
    expect(getServiceItemRowTitle(buildServiceItem())).toBe('Delivery');
    expect(getServiceItemRowTitle(buildServiceItem({ displayName: '' }))).toBe('delivery');
    expect(getServiceItemRowTitle(buildServiceItem({ displayName: '', itemKey: '' }))).toBe(
      'New service item',
    );
  });
});
