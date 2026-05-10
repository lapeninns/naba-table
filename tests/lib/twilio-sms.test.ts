import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  buildTwilioFetchMessageRequest,
  buildTwilioListMessagesRequest,
  buildTwilioSmsRequest,
  fetchTwilioMessage,
  mapTwilioMessageStatusToDeliveryStatus,
  validateTwilioWebhookSignature,
} from '@/lib/twilio/sms';

describe('buildTwilioSmsRequest', () => {
  it('includes ShortenUrls when link shortening is enabled', () => {
    const request = buildTwilioSmsRequest({
      accountSid: 'AC123',
      apiKeySid: 'SK123',
      apiKeySecret: 'secret',
      messagingServiceSid: 'MG123',
      to: '+447467586751',
      body: 'Hello world https://www.nabatable.com/bookings/recover/test',
      shortenUrls: true,
    });

    expect(request.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(String(request.init.body)).toContain('MessagingServiceSid=MG123');
    expect(String(request.init.body)).toContain('ShortenUrls=true');
  });

  it('omits ShortenUrls when link shortening is disabled', () => {
    const request = buildTwilioSmsRequest({
      accountSid: 'AC123',
      apiKeySid: 'SK123',
      apiKeySecret: 'secret',
      messagingServiceSid: 'MG123',
      to: '+447467586751',
      body: 'Hello world',
    });

    expect(String(request.init.body)).not.toContain('ShortenUrls=');
  });

  it('includes StatusCallback when provided', () => {
    const request = buildTwilioSmsRequest({
      accountSid: 'AC123',
      apiKeySid: 'SK123',
      apiKeySecret: 'secret',
      messagingServiceSid: 'MG123',
      to: '+447467586751',
      body: 'Hello world',
      statusCallback: 'https://app.nabatable.com/api/webhook/twilio/sms-status',
    });

    expect(String(request.init.body)).toContain(
      'StatusCallback=https%3A%2F%2Fapp.nabatable.com%2Fapi%2Fwebhook%2Ftwilio%2Fsms-status',
    );
  });
});

describe('buildTwilioListMessagesRequest', () => {
  it('builds a filtered messages list request', () => {
    const request = buildTwilioListMessagesRequest({
      accountSid: 'AC123',
      authToken: 'auth-token',
      to: '+447700900111',
      dateSentAfter: '2026-04-01',
      dateSentBefore: '2026-04-13',
      pageSize: 200,
    });

    expect(request.url).toContain('/2010-04-01/Accounts/AC123/Messages.json');
    expect(request.url).toContain('To=%2B447700900111');
    expect(request.url).toContain('DateSentAfter=2026-04-01');
    expect(request.url).toContain('DateSentBefore=2026-04-13');
    expect(request.url).toContain('PageSize=200');
    expect(request.init.method).toBe('GET');
  });

  it('uses next_page_uri verbatim when following pagination', () => {
    const request = buildTwilioListMessagesRequest({
      accountSid: 'AC123',
      authToken: 'auth-token',
      nextPageUri:
        '/2010-04-01/Accounts/AC123/Messages.json?Page=1&PageToken=PAMM123&PageSize=50',
      pageSize: 999,
      to: '+447700900111',
    });

    expect(request.url).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json?Page=1&PageToken=PAMM123&PageSize=50',
    );
  });
});

describe('buildTwilioFetchMessageRequest', () => {
  it('builds a single-message fetch request', () => {
    const request = buildTwilioFetchMessageRequest({
      accountSid: 'AC123',
      authToken: 'auth-token',
      messageSid: 'SM123',
    });

    expect(request.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM123.json');
    expect(request.init.method).toBe('GET');
  });
});

describe('mapTwilioMessageStatusToDeliveryStatus', () => {
  it('maps Twilio transport states into internal delivery states', () => {
    expect(mapTwilioMessageStatusToDeliveryStatus('accepted')).toBe('queued');
    expect(mapTwilioMessageStatusToDeliveryStatus('queued')).toBe('queued');
    expect(mapTwilioMessageStatusToDeliveryStatus('scheduled')).toBe('queued');
    expect(mapTwilioMessageStatusToDeliveryStatus('sending')).toBe('queued');
    expect(mapTwilioMessageStatusToDeliveryStatus('sent')).toBe('sent');
    expect(mapTwilioMessageStatusToDeliveryStatus('delivered')).toBe('delivered');
    expect(mapTwilioMessageStatusToDeliveryStatus('undelivered')).toBe('undelivered');
    expect(mapTwilioMessageStatusToDeliveryStatus('failed')).toBe('failed');
    expect(mapTwilioMessageStatusToDeliveryStatus('canceled')).toBe('failed');
    expect(mapTwilioMessageStatusToDeliveryStatus('unknown')).toBeNull();
  });
});

describe('fetchTwilioMessage', () => {
  it('parses a Twilio message resource response', async () => {
    const message = await fetchTwilioMessage({
      accountSid: 'AC123',
      authToken: 'auth-token',
      messageSid: 'SM123',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            sid: 'SM123',
            status: 'delivered',
            to: '+447700900111',
            from: '+447700900222',
            date_updated: 'Wed, 20 Apr 2026 10:00:00 +0000',
            error_code: null,
            error_message: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    expect(message.sid).toBe('SM123');
    expect(message.status).toBe('delivered');
    expect(message.to).toBe('+447700900111');
    expect(message.dateUpdated).toBe('Wed, 20 Apr 2026 10:00:00 +0000');
  });
});

describe('validateTwilioWebhookSignature', () => {
  it('accepts a correctly signed webhook payload', () => {
    const form = new URLSearchParams();
    form.set('MessageSid', 'SM123');
    form.set('MessageStatus', 'delivered');
    form.set('To', '+447700900123');

    const url = 'https://app.nabatable.com/api/webhook/twilio/sms-status';
    const data = `${url}MessageSidSM123MessageStatusdeliveredTo+447700900123`;
    const signature = createHmac('sha1', 'auth-token').update(data, 'utf8').digest('base64');

    expect(
      validateTwilioWebhookSignature({
        url,
        form,
        signature,
        authToken: 'auth-token',
      }),
    ).toBe(true);
  });
});
