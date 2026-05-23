import { describe, expect, it } from 'vitest';

import {
  deriveServiceItemKey,
  pickServiceItemDescription,
  pickServiceItemDisplayName,
  pickServiceItemType,
  shouldSyncLocationServiceItems,
} from '@/server/google-business-profile/businessInfoServiceItemNormalization';

import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';

describe('google business profile business info service item normalization', () => {
  it('respects optional service item fetch status', () => {
    expect(
      shouldSyncLocationServiceItems({
        __nabatableOptionalFetchStatus: { serviceItems: 'unavailable' },
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(false);

    expect(
      shouldSyncLocationServiceItems({
        __nabatableOptionalFetchStatus: { serviceItems: 'fetched' },
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(true);

    expect(
      shouldSyncLocationServiceItems({
        serviceItems: [],
      } as unknown as GoogleBusinessProfileLocationProfile),
    ).toBe(true);
  });

  it('picks service item display fields by existing candidate order', () => {
    const item = {
      displayName: '',
      name: '  Named Service ',
      serviceName: 'Ignored Service',
      type: '',
      serviceType: 'event',
      category: 'ignored',
      description: '',
      shortDescription: ' Short description ',
      summary: 'ignored summary',
    };

    expect(pickServiceItemDisplayName(item)).toBe('Named Service');
    expect(pickServiceItemType(item)).toBe('event');
    expect(pickServiceItemDescription(item)).toBe('Short description');
  });

  it('derives service item keys from direct identifiers before fallback hashes', () => {
    expect(deriveServiceItemKey({ structuredServiceItemId: ' structured-1 ' }, 0)).toBe(
      'structured-1',
    );
    expect(deriveServiceItemKey({ serviceItemId: 'service-1' }, 0)).toBe('service-1');
    expect(deriveServiceItemKey({ itemId: 'item-1' }, 0)).toBe('item-1');
    expect(deriveServiceItemKey({ name: 'Name Key' }, 0)).toBe('Name Key');
    expect(deriveServiceItemKey({ title: 'Fallback only' }, 2)).toBe(
      'service_item_2_78bfc499235a626b',
    );
  });
});
