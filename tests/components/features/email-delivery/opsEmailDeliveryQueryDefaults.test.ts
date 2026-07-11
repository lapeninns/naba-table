import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailDeliveryQueryDefaults,
  type OpsEmailDeliveryQueryStateParams,
} from '@/components/features/email-delivery/opsEmailDeliveryQueryDefaults';

describe('opsEmailDeliveryQueryDefaults', () => {
  it('@contract projects exactly the initial-value fields, dropping runtime-only state params', () => {
    const params: OpsEmailDeliveryQueryStateParams = {
      effectiveRestaurantId: '11111111-1111-4111-8111-111111111111',
      pathname: '/app/email-delivery',
      searchParams: new URLSearchParams('page=3'),
      initialTab: 'queue',
      initialRestaurantId: '22222222-2222-4222-8222-222222222222',
      initialRange: '30d',
      initialPage: 3,
      initialPageSize: 100,
      initialStatuses: ['failed'],
      initialSimulateEmailDeliveryError: true,
      initialFixture: 'fixture-a',
      initialQueueFixture: 'queue-fixture-b',
      initialSimulateRetryMutationError: true,
      initialRecipientEmail: 'guest@example.com',
      initialMessageId: 'msg-1',
      initialBookingRef: 'REF123',
      initialTemplateType: 'booking_confirmation',
      initialEmailType: 'created',
    };

    const defaults = buildOpsEmailDeliveryQueryDefaults(params);

    expect(defaults).toEqual({
      initialTab: 'queue',
      initialRestaurantId: '22222222-2222-4222-8222-222222222222',
      initialRange: '30d',
      initialPage: 3,
      initialPageSize: 100,
      initialStatuses: ['failed'],
      initialSimulateEmailDeliveryError: true,
      initialFixture: 'fixture-a',
      initialQueueFixture: 'queue-fixture-b',
      initialSimulateRetryMutationError: true,
      initialRecipientEmail: 'guest@example.com',
      initialMessageId: 'msg-1',
      initialBookingRef: 'REF123',
      initialTemplateType: 'booking_confirmation',
      initialEmailType: 'created',
    });
    expect(defaults).not.toHaveProperty('effectiveRestaurantId');
    expect(defaults).not.toHaveProperty('pathname');
    expect(defaults).not.toHaveProperty('searchParams');
  });
});
