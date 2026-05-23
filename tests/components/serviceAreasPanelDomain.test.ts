import { describe, expect, it } from 'vitest';

import {
  getServiceAreaAdvancedSubtitle,
  getServiceAreaChipLabel,
  SERVICE_AREA_MAIN_FIELDS,
  SERVICE_AREA_PROVIDER_FIELDS,
} from '@/components/features/restaurant-settings/discovery/panels/serviceAreasPanelDomain';

import type { ServiceAreaEditor } from '@/components/features/restaurant-settings/businessContextModel';

const buildServiceArea = (overrides: Partial<ServiceAreaEditor> = {}): ServiceAreaEditor => ({
  id: 'service-area-1',
  displayName: 'Cambridge',
  areaType: 'city',
  regionCode: 'GB',
  googlePlaceId: 'place-1',
  googlePlaceResourceName: 'places/place-1',
  placeDataJson: '{}',
  ...overrides,
});

describe('serviceAreasPanelDomain', () => {
  it('keeps service-area field specs stable', () => {
    expect(SERVICE_AREA_MAIN_FIELDS.map((field) => field.field)).toEqual([
      'displayName',
      'areaType',
      'regionCode',
    ]);
    expect(SERVICE_AREA_PROVIDER_FIELDS.map((field) => field.field)).toEqual([
      'googlePlaceId',
      'googlePlaceResourceName',
    ]);
  });

  it('derives chip labels from the shared business-context title helper', () => {
    expect(getServiceAreaChipLabel(buildServiceArea())).toBe('Cambridge');
    expect(
      getServiceAreaChipLabel(buildServiceArea({ displayName: '', googlePlaceId: 'abc' })),
    ).toBe('New service area');
  });

  it('builds advanced row subtitles with defaults', () => {
    expect(getServiceAreaAdvancedSubtitle(buildServiceArea())).toBe('city · GB');
    expect(getServiceAreaAdvancedSubtitle(buildServiceArea({ areaType: '', regionCode: '' }))).toBe(
      'region',
    );
  });
});
