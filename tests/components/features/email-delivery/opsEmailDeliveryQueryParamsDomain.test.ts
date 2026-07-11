import { describe, expect, it } from 'vitest';

import * as queryDomain from '@/components/features/email-delivery/opsEmailDeliveryQueryDomain';
import {
  buildOpsEmailDeliveryQueryString,
  getOpsEmailDeliveryTargetPath,
  parseOpsEmailDeliveryQuery,
  parseOpsEmailDeliveryUuid,
  type OpsEmailDeliveryQueryDefaults,
} from '@/components/features/email-delivery/opsEmailDeliveryQueryParamsDomain';

const defaults: OpsEmailDeliveryQueryDefaults = {
  initialTab: 'delivery-log',
  initialRestaurantId: null,
  initialRange: '7d',
  initialPage: 1,
  initialPageSize: 50,
  initialStatuses: [],
  initialSimulateEmailDeliveryError: false,
  initialFixture: null,
  initialQueueFixture: null,
  initialSimulateRetryMutationError: false,
  initialRecipientEmail: null,
  initialMessageId: null,
  initialBookingRef: null,
  initialTemplateType: null,
  initialEmailType: null,
};

describe('opsEmailDeliveryQueryParamsDomain', () => {
  it('@contract is the module re-exported by opsEmailDeliveryQueryDomain (same function identities)', () => {
    // The broader behavioral matrix lives in opsEmailDeliveryQueryDomain.test.ts;
    // this locks the seam so that suite keeps covering this module.
    expect(queryDomain.parseOpsEmailDeliveryQuery).toBe(parseOpsEmailDeliveryQuery);
    expect(queryDomain.buildOpsEmailDeliveryQueryString).toBe(buildOpsEmailDeliveryQueryString);
    expect(queryDomain.getOpsEmailDeliveryTargetPath).toBe(getOpsEmailDeliveryTargetPath);
    expect(queryDomain.parseOpsEmailDeliveryUuid).toBe(parseOpsEmailDeliveryUuid);
  });

  it('@contract trims and validates uuids, rejecting non-uuid values', () => {
    expect(parseOpsEmailDeliveryUuid('  11111111-1111-4111-8111-111111111111  ')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(parseOpsEmailDeliveryUuid(null)).toBeNull();
    expect(parseOpsEmailDeliveryUuid('   ')).toBeNull();
    expect(parseOpsEmailDeliveryUuid('rest-1')).toBeNull();
  });

  it('@contract clamps page to at least 1 and pageSize into the 1-200 window', () => {
    const parsed = parseOpsEmailDeliveryQuery('page=-4&pageSize=9999', defaults);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(200);

    const tiny = parseOpsEmailDeliveryQuery('pageSize=0', defaults);
    expect(tiny.pageSize).toBe(1);

    const garbage = parseOpsEmailDeliveryQuery('page=abc&pageSize=abc', defaults);
    expect(garbage.page).toBe(defaults.initialPage);
    expect(garbage.pageSize).toBe(defaults.initialPageSize);
  });

  it('@contract keeps only known statuses and uppercases booking references', () => {
    const parsed = parseOpsEmailDeliveryQuery(
      'status=failed,%20delivered,bogus&bookingRef=abc123',
      defaults,
    );
    expect(parsed.statuses).toEqual(['failed', 'delivered']);
    expect(parsed.bookingRef).toBe('ABC123');
  });
});
