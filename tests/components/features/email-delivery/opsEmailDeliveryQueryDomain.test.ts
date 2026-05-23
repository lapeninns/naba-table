import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailDeliveryClearFiltersNext,
  buildOpsEmailDeliveryClearFiltersStateSnapshot,
  buildOpsEmailDeliveryDefaultsStateSnapshot,
  buildOpsEmailDeliveryQueryString,
  buildOpsEmailDeliveryQueryStateSnapshot,
  buildOpsEmailDeliveryResetNext,
  buildOpsEmailDeliverySubmittedSearch,
  getOpsEmailDeliveryTargetPath,
  parseOpsEmailDeliveryQuery,
  parseOpsEmailDeliveryUuid,
  resolveOpsEmailDeliverySearchField,
  resolveOpsEmailDeliverySearchValue,
  toggleOpsEmailDeliveryStatusFilter,
  type OpsEmailDeliveryQueryDefaults,
  type OpsEmailDeliveryQuerySyncState,
} from '@/components/features/email-delivery/opsEmailDeliveryQueryDomain';

const validRestaurantId = '11111111-1111-4111-8111-111111111111';
const fallbackRestaurantId = '22222222-2222-4222-8222-222222222222';

const defaults: OpsEmailDeliveryQueryDefaults = {
  initialTab: 'delivery-log',
  initialRestaurantId: fallbackRestaurantId,
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

const currentState: OpsEmailDeliveryQuerySyncState = {
  tab: 'delivery-log',
  range: '7d',
  page: 1,
  pageSize: 50,
  refresh: 'off',
  fixture: null,
  queueFixture: null,
  recipientEmail: null,
  messageId: null,
  bookingRef: null,
  templateType: null,
  emailType: null,
  statuses: [],
  simulateEmailDeliveryError: false,
  simulateRetryMutationError: false,
};

describe('opsEmailDeliveryQueryDomain', () => {
  it('parses query params with validation, clamping, defaults, and normalized booking refs', () => {
    const parsed = parseOpsEmailDeliveryQuery(
      [
        `restaurantId=${validRestaurantId}`,
        'tab=analytics',
        'range=30d',
        'page=-4',
        'pageSize=500',
        'status=sent,unknown,failed',
        'refresh=1m',
        'bookingRef=nb123',
        'fixture=retry-actions',
        'simulateEmailDeliveryError=1',
      ].join('&'),
      defaults,
    );

    expect(parsed).toMatchObject({
      restaurantId: validRestaurantId,
      tab: 'analytics',
      range: '30d',
      page: 1,
      pageSize: 200,
      statuses: ['sent', 'failed'],
      refresh: '1m',
      bookingRef: 'NB123',
      fixture: 'retry-actions',
      simulateEmailDeliveryError: true,
    });
  });

  it('falls back for invalid ids and resolves search field/value priority', () => {
    expect(parseOpsEmailDeliveryUuid('not-a-uuid')).toBeNull();
    expect(parseOpsEmailDeliveryQuery('restaurantId=not-a-uuid', defaults).restaurantId).toBe(
      fallbackRestaurantId,
    );
    expect(
      resolveOpsEmailDeliverySearchField({
        recipientEmail: 'guest@example.com',
        messageId: 'msg_123',
        bookingRef: 'NB123',
      }),
    ).toBe('messageId');
    expect(
      resolveOpsEmailDeliverySearchValue({
        recipientEmail: null,
        messageId: null,
        bookingRef: 'NB123',
      }),
    ).toBe('NB123');
  });

  it('resolves app-host and fallback target paths', () => {
    expect(getOpsEmailDeliveryTargetPath('/app/email-delivery')).toBe('/app/email-delivery');
    expect(getOpsEmailDeliveryTargetPath('/dev/ops-email-delivery')).toBe(
      '/dev/ops-email-delivery',
    );
    expect(getOpsEmailDeliveryTargetPath(null)).toBe('/email-delivery');
  });

  it('serializes query updates while preserving unknown params and removing defaults', () => {
    const queued = new URLSearchParams(
      buildOpsEmailDeliveryQueryString({
        currentSearch: 'debug=1',
        next: {
          tab: 'queue',
          range: '24h',
          page: 2,
          statuses: ['failed', 'sent'],
          recipientEmail: 'guest@example.com',
        },
        current: currentState,
        defaults,
        effectiveRestaurantId: validRestaurantId,
      }),
    );

    expect(queued.get('debug')).toBe('1');
    expect(queued.get('restaurantId')).toBe(validRestaurantId);
    expect(queued.get('tab')).toBe('queue');
    expect(queued.get('range')).toBe('24h');
    expect(queued.get('page')).toBe('2');
    expect(queued.get('status')).toBe('failed,sent');
    expect(queued.get('recipientEmail')).toBe('guest@example.com');

    const reset = new URLSearchParams(
      buildOpsEmailDeliveryQueryString({
        currentSearch: 'debug=1&tab=queue&range=24h&page=2&status=failed',
        next: {
          tab: 'delivery-log',
          range: '7d',
          page: 1,
          statuses: [],
        },
        current: {
          ...currentState,
          tab: 'queue',
          range: '24h',
          page: 2,
          statuses: ['failed'],
        },
        defaults,
        effectiveRestaurantId: null,
      }),
    );

    expect(reset.get('debug')).toBe('1');
    expect(reset.has('tab')).toBe(false);
    expect(reset.has('range')).toBe(false);
    expect(reset.has('page')).toBe(false);
    expect(reset.has('status')).toBe(false);
  });

  it('builds submitted search patches with field-specific normalization', () => {
    expect(
      buildOpsEmailDeliverySubmittedSearch({
        searchField: 'recipientEmail',
        searchValue: ' GUEST@EXAMPLE.COM ',
      }),
    ).toEqual({
      recipientEmail: 'guest@example.com',
      messageId: null,
      bookingRef: null,
      page: 1,
    });
    expect(
      buildOpsEmailDeliverySubmittedSearch({
        searchField: 'bookingRef',
        searchValue: ' nb123 ',
      }),
    ).toEqual({
      recipientEmail: null,
      messageId: null,
      bookingRef: 'NB123',
      page: 1,
    });
    expect(
      buildOpsEmailDeliverySubmittedSearch({
        searchField: 'messageId',
        searchValue: ' msg_MixedCase ',
      }),
    ).toEqual({
      recipientEmail: null,
      messageId: 'msg_MixedCase',
      bookingRef: null,
      page: 1,
    });
  });

  it('toggles status filters without duplicates', () => {
    expect(
      toggleOpsEmailDeliveryStatusFilter({
        enabled: true,
        status: 'failed',
        statuses: ['sent', 'failed'],
      }),
    ).toEqual(['sent', 'failed']);
    expect(
      toggleOpsEmailDeliveryStatusFilter({
        enabled: false,
        status: 'sent',
        statuses: ['sent', 'failed'],
      }),
    ).toEqual(['failed']);
  });

  it('builds reset and clear-filter query patches', () => {
    expect(buildOpsEmailDeliveryResetNext({ defaults, restaurantId: validRestaurantId })).toEqual({
      restaurantId: validRestaurantId,
      tab: 'delivery-log',
      range: '7d',
      page: 1,
      pageSize: 50,
      refresh: 'off',
      statuses: [],
      simulateEmailDeliveryError: false,
      simulateRetryMutationError: false,
      fixture: null,
      queueFixture: null,
      recipientEmail: null,
      messageId: null,
      bookingRef: null,
      templateType: null,
      emailType: null,
    });

    expect(buildOpsEmailDeliveryClearFiltersNext()).toEqual({
      range: '7d',
      page: 1,
      statuses: [],
      simulateEmailDeliveryError: false,
      simulateRetryMutationError: false,
      fixture: null,
      queueFixture: null,
      recipientEmail: null,
      messageId: null,
      bookingRef: null,
      templateType: null,
      emailType: null,
    });
  });

  it('builds local state snapshots from parsed queries and defaults', () => {
    const parsed = parseOpsEmailDeliveryQuery(
      'tab=queue&range=30d&page=3&pageSize=25&bookingRef=nb123&status=failed&refresh=30s',
      defaults,
    );

    expect(buildOpsEmailDeliveryQueryStateSnapshot(parsed)).toMatchObject({
      tab: 'queue',
      range: '30d',
      page: 3,
      pageSize: 25,
      statuses: ['failed'],
      refresh: '30s',
      bookingRef: 'NB123',
      searchField: 'bookingRef',
      searchValue: 'NB123',
    });

    expect(
      buildOpsEmailDeliveryDefaultsStateSnapshot({
        ...defaults,
        initialRecipientEmail: 'guest@example.com',
        initialPage: 2,
      }),
    ).toMatchObject({
      tab: 'delivery-log',
      range: '7d',
      page: 2,
      refresh: 'off',
      recipientEmail: 'guest@example.com',
      searchField: 'recipientEmail',
      searchValue: 'guest@example.com',
    });
  });

  it('builds clear-filter state snapshots while preserving tab, page size, and refresh cadence', () => {
    expect(
      buildOpsEmailDeliveryClearFiltersStateSnapshot({
        ...currentState,
        tab: 'analytics',
        range: '30d',
        statuses: ['failed'],
        page: 4,
        pageSize: 25,
        refresh: '1m',
        simulateEmailDeliveryError: true,
        simulateRetryMutationError: true,
        fixture: 'delivery-error',
        queueFixture: 'retry-error',
        recipientEmail: 'guest@example.com',
        messageId: null,
        bookingRef: null,
        templateType: 'booking_confirmation',
        emailType: 'booking_confirmation',
        searchField: 'recipientEmail',
        searchValue: 'guest@example.com',
      }),
    ).toMatchObject({
      tab: 'analytics',
      range: '7d',
      statuses: [],
      page: 1,
      pageSize: 25,
      refresh: '1m',
      simulateEmailDeliveryError: false,
      simulateRetryMutationError: false,
      fixture: null,
      queueFixture: null,
      recipientEmail: null,
      messageId: null,
      bookingRef: null,
      templateType: null,
      emailType: null,
      searchField: 'recipientEmail',
      searchValue: '',
    });
  });
});
