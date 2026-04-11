import { describe, expect, it } from 'vitest';

import { buildTwilioSmsRequest } from '@/lib/twilio/sms';

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
});
