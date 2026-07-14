import { describe, expect, it } from 'vitest';

import { envSchemas, findBlockedPublicEnvKeys, resolveEnvSchemaTarget } from '@/config/env.schema';

describe('resolveEnvSchemaTarget', () => {
  it('uses development schema for local staging builds @contract @local-only', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        VERCEL_ENV: undefined,
      }),
    ).toBe('development');
  });

  it('uses production schema for production app targets @contract @local-only', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        VERCEL_ENV: undefined,
      }),
    ).toBe('production');
  });

  it('uses production schema for production vercel targets @contract @local-only', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        VERCEL_ENV: 'production',
      }),
    ).toBe('production');
  });

  it('preserves test schema selection @contract @local-only', () => {
    expect(
      resolveEnvSchemaTarget({
        NODE_ENV: 'test',
        APP_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).toBe('test');
  });
});

describe('public env secret blocking', () => {
  it('blocks NEXT_PUBLIC secret-looking names unless explicitly allowlisted @contract @security @local-only', () => {
    expect(
      findBlockedPublicEnvKeys({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com',
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'secret',
        NEXT_PUBLIC_INVITE_TOKEN: 'secret',
        NEXT_PUBLIC_DATABASE_URL: 'postgres://secret',
      }),
    ).toEqual([
      'NEXT_PUBLIC_DATABASE_URL',
      'NEXT_PUBLIC_INVITE_TOKEN',
      'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });
});

describe('production env schema', () => {
  const productionEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    NEXT_PUBLIC_APP_URL: 'https://app.nabatable.com',
    NEXT_PUBLIC_SITE_URL: 'https://www.nabatable.com',
    NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
    RESEND_API_KEY: 'resend',
    RESEND_FROM: 'no-reply@notifications.nabatable.com',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    AUTH_AUDIT_HASH_SECRET: 'auth-audit-secret',
    CRON_SECRET: 'cron-secret',
  };

  it('requires PostHog browser configuration for production targets @contract @local-only', () => {
    const input = Object.fromEntries(
      Object.entries(productionEnv).filter(
        ([key]) => key !== 'NEXT_PUBLIC_POSTHOG_HOST' && key !== 'NEXT_PUBLIC_POSTHOG_KEY',
      ),
    );

    const result = envSchemas.production.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toContain(
        'NEXT_PUBLIC_POSTHOG_HOST',
      );
      expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toContain(
        'NEXT_PUBLIC_POSTHOG_KEY',
      );
    }
  });

  it('fails production validation when rate limiting has no gateway or explicit fallback @contract @local-only', () => {
    const result = envSchemas.production.safeParse(productionEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toContain(
        'CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL',
      );
    }
  });

  it('accepts production rate limiting with Cloudflare gateway credentials @contract @local-only', () => {
    const result = envSchemas.production.safeParse({
      ...productionEnv,
      CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL: 'https://gateway.example.com/rate-limit',
      CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN: 'gateway-token',
    });

    expect(result.success).toBe(true);
  });

  it('accepts production rate limiting with an explicit memory fallback override @contract @local-only', () => {
    const result = envSchemas.production.safeParse({
      ...productionEnv,
      ALLOW_MEMORY_RATE_LIMIT_IN_PROD: 'true',
    });

    expect(result.success).toBe(true);
  });

  it('treats empty optional integration variables as unset @contract @local-only', () => {
    const result = envSchemas.production.safeParse({
      ...productionEnv,
      ALLOW_MEMORY_RATE_LIMIT_IN_PROD: 'true',
      CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN: '',
      GOOGLE_BUSINESS_PROFILE_CLIENT_ID: '',
      GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET: '',
      GOOGLE_BUSINESS_PROFILE_REDIRECT_URI: '',
      GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a partially configured five-event WhatsApp production set @contract @local-only', () => {
    const result = envSchemas.production.safeParse({
      ...productionEnv,
      ALLOW_MEMORY_RATE_LIMIT_IN_PROD: 'true',
      TWILIO_WHATSAPP_SENDER: '+447700900000',
      TWILIO_WHATSAPP_BOOKING_CONFIRMATION_CONTENT_SID: 'HX5314cca961d164966548d0a55fc85a57',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining([
          'TWILIO_WHATSAPP_BOOKING_UPDATE_CONTENT_SID',
          'TWILIO_WHATSAPP_BOOKING_CANCELLATION_CONTENT_SID',
          'TWILIO_WHATSAPP_RESTAURANT_CANCELLATION_CONTENT_SID',
          'TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID',
        ]),
      );
    }
  });

  it('accepts the complete five-event WhatsApp production set @contract @local-only', () => {
    const result = envSchemas.production.safeParse({
      ...productionEnv,
      ALLOW_MEMORY_RATE_LIMIT_IN_PROD: 'true',
      TWILIO_WHATSAPP_SENDER: '+447700900000',
      TWILIO_WHATSAPP_BOOKING_CONFIRMATION_CONTENT_SID: 'HXconfirmation',
      TWILIO_WHATSAPP_BOOKING_UPDATE_CONTENT_SID: 'HXupdate',
      TWILIO_WHATSAPP_BOOKING_CANCELLATION_CONTENT_SID: 'HXguestcancel',
      TWILIO_WHATSAPP_RESTAURANT_CANCELLATION_CONTENT_SID: 'HXvenuecancel',
      TWILIO_WHATSAPP_REVIEW_REQUEST_CONTENT_SID: 'HXreview',
    });

    expect(result.success).toBe(true);
  });
});
