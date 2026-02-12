import { describe, expect, it } from 'vitest';

import { parseEmailDeliverySearch } from '@src/lib/email-delivery/search';

describe('parseEmailDeliverySearch', () => {
  it('returns empty filters for blank input', () => {
    expect(parseEmailDeliverySearch('')).toEqual({});
    expect(parseEmailDeliverySearch('   ')).toEqual({});
  });

  it('parses prefixed recipient searches', () => {
    expect(parseEmailDeliverySearch('to:Guest@Example.com')).toEqual({
      recipientEmail: 'guest@example.com',
    });
    expect(parseEmailDeliverySearch('email: sam.patel@example.com')).toEqual({
      recipientEmail: 'sam.patel@example.com',
    });
  });

  it('parses prefixed message id searches', () => {
    expect(parseEmailDeliverySearch('msg:fd1440c1-a4bf-4e2f-ba5d-737d96c7f6ea')).toEqual({
      messageId: 'fd1440c1-a4bf-4e2f-ba5d-737d96c7f6ea',
    });
    expect(parseEmailDeliverySearch('msg: msg-aaaa-bbbb-cccc')).toEqual({
      messageId: 'msg-aaaa-bbbb-cccc',
    });
  });

  it('parses prefixed booking reference searches', () => {
    expect(parseEmailDeliverySearch('ref: dev123')).toEqual({ bookingRef: 'DEV123' });
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

  it('treats Resend-like msg ids as messageId', () => {
    expect(parseEmailDeliverySearch('msg-aaaa-bbbb-cccc')).toEqual({
      messageId: 'msg-aaaa-bbbb-cccc',
    });
    expect(parseEmailDeliverySearch('msg_dddd_eeee_ffff')).toEqual({
      messageId: 'msg_dddd_eeee_ffff',
    });
  });

  it('treats dashy ids as messageId (heuristic)', () => {
    expect(parseEmailDeliverySearch('abcd-efgh-ijkl-mnop')).toEqual({
      messageId: 'abcd-efgh-ijkl-mnop',
    });
  });

  it('treats other values as bookingRef and uppercases', () => {
    expect(parseEmailDeliverySearch('fd1440c1')).toEqual({ bookingRef: 'FD1440C1' });
    expect(parseEmailDeliverySearch(' ba12071e ')).toEqual({ bookingRef: 'BA12071E' });
  });
});
