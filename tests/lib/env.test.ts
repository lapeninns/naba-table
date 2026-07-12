import { afterEach, describe, expect, it } from 'vitest';

import { env, getEnv, resetEnvCache } from '@/lib/env';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
  resetEnvCache();
}

describe('env app URL resolution', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('resolves Vercel URL templates before validating public app URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://${VERCEL_URL}';
    process.env.VERCEL_URL = 'preview-nabatable.vercel.app';
    resetEnvCache();

    expect(getEnv().NEXT_PUBLIC_APP_URL).toBe('https://preview-nabatable.vercel.app');
    expect(env.app.url).toBe('https://preview-nabatable.vercel.app');
  });

  it('drops unresolved Vercel URL templates and falls back to the site URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://${VERCEL_URL}';
    delete process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.nabatable.com';
    resetEnvCache();

    expect(getEnv().NEXT_PUBLIC_APP_URL).toBeUndefined();
    expect(env.app.url).toBe('https://www.nabatable.com');
  });

  it('does not resolve public app URL from a placeholder Vercel URL value', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://${VERCEL_URL}';
    process.env.VERCEL_URL = '${VERCEL_URL}';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.nabatable.com';
    resetEnvCache();

    expect(getEnv().NEXT_PUBLIC_APP_URL).toBeUndefined();
    expect(env.app.url).toBe('https://www.nabatable.com');
  });

  it('resolves Vercel URL templates before validating base URL', () => {
    process.env.BASE_URL = 'https://${VERCEL_URL}';
    process.env.VERCEL_URL = 'preview-nabatable.vercel.app';
    resetEnvCache();

    expect(getEnv().BASE_URL).toBe('https://preview-nabatable.vercel.app');
  });

  it('drops unresolved base URL templates and falls back to a canonical URL', () => {
    process.env.BASE_URL = 'https://${VERCEL_URL}';
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    resetEnvCache();

    expect(getEnv().BASE_URL).toBe('https://nabatable.com');
  });
});

describe('WhatsApp five-event configuration', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('stays disabled until the review Content SID completes the lifecycle set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_API_KEY_SID = 'SK123';
    process.env.TWILIO_API_KEY_SECRET = 'secret';
    process.env.TWILIO_WHATSAPP_SENDER = '+447700900000';
    process.env.TWILIO_WHATSAPP_BOOKING_CONFIRMATION_CONTENT_SID = 'HXconfirmation';
    process.env.TWILIO_WHATSAPP_BOOKING_UPDATE_CONTENT_SID = 'HXupdate';
    process.env.TWILIO_WHATSAPP_BOOKING_CANCELLATION_CONTENT_SID = 'HXguestcancel';
    process.env.TWILIO_WHATSAPP_RESTAURANT_CANCELLATION_CONTENT_SID = 'HXvenuecancel';
    delete process.env.TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID;
    resetEnvCache();

    expect(env.twilio.whatsapp.configured).toBe(false);

    process.env.TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID = 'HXreview';
    resetEnvCache();

    expect(env.twilio.whatsapp.configured).toBe(true);
    expect(env.twilio.whatsapp.templates.reviewRequest).toBe('HXreview');
  });
});

export {};
