import { describe, expect, it } from 'vitest';

import { parseEmailDeliverySearch } from '@src/lib/email-delivery/search';

describe('parseEmailDeliverySearch', () => {
  it('returns empty filters for blank input', () => {
    expect(parseEmailDeliverySearch('')).toEqual({});
    expect(parseEmailDeliverySearch('   ')).toEqual({});
  });

  it('treats values containing @ as recipientEmail', () => {
    expect(parseEmailDeliverySearch('Guest@Example.com')).toEqual({
      recipientEmail: 'guest@example.com',
    });
  });

  it('treats UUID-like values as messageId', () => {
    expect(parseEmailDeliverySearch('fd1440c1-a4bf-4e2f-ba5d-737d96c7f6ea')).toEqual({
      messageId: 'fd1440c1-a4bf-4e2f-ba5d-737d96c7f6ea',
    });
  });

  it('treats other values as bookingRef and uppercases', () => {
    expect(parseEmailDeliverySearch('fd1440c1')).toEqual({ bookingRef: 'FD1440C1' });
    expect(parseEmailDeliverySearch(' ba12071e ')).toEqual({ bookingRef: 'BA12071E' });
  });
});

