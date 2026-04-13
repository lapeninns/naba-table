import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildTwilioSmsRequest,
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

describe('mapTwilioMessageStatusToDeliveryStatus', () => {
  it('maps Twilio transport states into internal delivery states', () => {
    expect(mapTwilioMessageStatusToDeliveryStatus('queued')).toBe('queued');
    expect(mapTwilioMessageStatusToDeliveryStatus('sent')).toBe('sent');
    expect(mapTwilioMessageStatusToDeliveryStatus('delivered')).toBe('delivered');
    expect(mapTwilioMessageStatusToDeliveryStatus('undelivered')).toBe('undelivered');
    expect(mapTwilioMessageStatusToDeliveryStatus('failed')).toBe('failed');
    expect(mapTwilioMessageStatusToDeliveryStatus('canceled')).toBe('failed');
    expect(mapTwilioMessageStatusToDeliveryStatus('unknown')).toBeNull();
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
