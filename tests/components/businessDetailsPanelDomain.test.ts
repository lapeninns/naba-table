import { describe, expect, it } from 'vitest';

import {
  BUSINESS_DETAILS_OPENING_DATE_FIELD,
  BUSINESS_DETAILS_SERVICE_AREA_FIELD,
  BUSINESS_DETAILS_STATUS_FIELD,
  BUSINESS_DETAILS_STATUS_OPTIONS,
} from '@/components/features/restaurant-settings/discovery/panels/businessDetailsPanelDomain';

describe('businessDetailsPanelDomain', () => {
  it('keeps opening date field metadata stable', () => {
    expect(BUSINESS_DETAILS_OPENING_DATE_FIELD).toEqual({
      id: 'business-details-opening-date',
      label: 'Opening date',
      field: 'openingDate',
      helperText: 'Optional.',
      type: 'date',
    });
  });

  it('keeps business status field metadata and options stable', () => {
    expect(BUSINESS_DETAILS_STATUS_FIELD).toEqual({
      id: 'business-details-status',
      label: 'Business status',
      helperText: 'Shown on public listings.',
    });
    expect(BUSINESS_DETAILS_STATUS_OPTIONS).toEqual([
      { value: 'unset', label: 'Not set' },
      { value: 'open', label: 'Open' },
      { value: 'closed_temporarily', label: 'Closed temporarily' },
      { value: 'closed_permanently', label: 'Closed permanently' },
    ]);
  });

  it('keeps service-area business switch metadata stable', () => {
    expect(BUSINESS_DETAILS_SERVICE_AREA_FIELD).toEqual({
      id: 'business-details-service-area-business',
      label: 'We serve customers at their location',
      field: 'isServiceAreaBusiness',
      helperText: 'For delivery or catering. Add the towns or areas you serve below.',
    });
  });
});
