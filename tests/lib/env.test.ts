import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it } from 'vitest';

import { envSchemas } from '@/config/env.schema';
import { env, getEnv, resetEnvCache } from '@/lib/env';

const originalEnv = { ...process.env };
const validEncryptionKey = Buffer.alloc(32, 7).toString('base64url');
const directTestEnv = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
} as const;

function captureEnvErrorMessage(): string {
  try {
    getEnv();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error('Expected environment parsing to fail.');
}

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

  it('stays disabled until the review Content SID completes the lifecycle set @contract', () => {
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

describe('Google Business Profile environment aliases', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('prefers explicit canonical credentials over legacy profile aliases', () => {
    process.env.GOOGLE_BUSINESS_CLIENT_ID = 'canonical-client-id';
    process.env.GOOGLE_BUSINESS_CLIENT_SECRET = 'canonical-client-secret';
    process.env.GOOGLE_BUSINESS_REDIRECT_URI = 'https://canonical.example.com/callback';
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY = 'canonical-encryption-key';
    process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID = 'legacy-client-id';
    process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET = 'legacy-client-secret';
    process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI = 'https://legacy.example.com/callback';
    process.env.GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY = 'legacy-encryption-key';
    resetEnvCache();

    expect(env.googleBusinessProfile).toMatchObject({
      clientId: 'canonical-client-id',
      clientSecret: 'canonical-client-secret',
      redirectUri: 'https://canonical.example.com/callback',
      tokenEncryptionKey: 'canonical-encryption-key',
      configured: true,
    });
  });

  it('uses fail-closed defaults for dual-sync runtime controls', () => {
    for (const name of [
      'GBP_IMPORT_ENABLED',
      'GBP_EXPORT_ENABLED',
      'GBP_AUTO_CANDIDATES_ENABLED',
      'GBP_HIGH_RISK_EXPORTS_ENABLED',
      'GBP_MENU_SYNC_ENABLED',
      'GBP_ATTRIBUTES_SYNC_ENABLED',
      'GBP_SCHEDULED_REFRESH_ENABLED',
      'GBP_PUBSUB_INGEST_ENABLED',
      'GBP_WRITE_ROLLOUT_MODE',
      'GBP_CANARY_RESTAURANT_ID',
    ] as const) {
      delete process.env[name];
    }
    resetEnvCache();

    expect(getEnv()).toMatchObject({
      GBP_IMPORT_ENABLED: false,
      GBP_EXPORT_ENABLED: false,
      GBP_AUTO_CANDIDATES_ENABLED: true,
      GBP_HIGH_RISK_EXPORTS_ENABLED: false,
      GBP_MENU_SYNC_ENABLED: false,
      GBP_ATTRIBUTES_SYNC_ENABLED: false,
      GBP_SCHEDULED_REFRESH_ENABLED: false,
      GBP_PUBSUB_INGEST_ENABLED: false,
      GBP_WRITE_ROLLOUT_MODE: 'off',
    });
  });

  it.each([
    ['GBP_IMPORT_ENABLED', 'yes'],
    ['GBP_PUBSUB_INGEST_ENABLED', '1'],
    ['GBP_WRITE_ROLLOUT_MODE', 'enabled'],
  ] as const)('rejects malformed %s input', (name, value) => {
    process.env[name] = value;
    resetEnvCache();

    expect(() => getEnv()).toThrow(`Environment validation failed at runtime:\n${name}:`);
  });

  it('rejects canary rollout without a canary restaurant identifier', () => {
    process.env.GBP_WRITE_ROLLOUT_MODE = 'canary';
    delete process.env.GBP_CANARY_RESTAURANT_ID;
    resetEnvCache();

    expect(() => getEnv()).toThrow(
      'Environment validation failed at runtime:\nGBP_CANARY_RESTAURANT_ID:',
    );
  });

  it('preserves legacy single-key configuration when no keyring is present', () => {
    delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID;
    delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS;
    process.env.GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY = validEncryptionKey;
    process.env.GOOGLE_BUSINESS_CLIENT_ID = 'client-id';
    process.env.GOOGLE_BUSINESS_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_BUSINESS_REDIRECT_URI = 'https://example.com/callback';
    resetEnvCache();

    expect(env.googleBusinessProfile).toMatchObject({
      tokenEncryptionKey: validEncryptionKey,
      tokenEncryptionKeyring: null,
      configured: true,
    });
  });

  it('normalizes a valid credential keyring without exposing mutable key storage', () => {
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'primary-2026';
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS = JSON.stringify({
      'primary-2026': validEncryptionKey,
    });
    resetEnvCache();

    expect(env.googleBusinessProfile.tokenEncryptionKeyring).toEqual({
      activeKeyId: 'primary-2026',
      keys: { 'primary-2026': validEncryptionKey },
    });
    expect(Object.isFrozen(env.googleBusinessProfile.tokenEncryptionKeyring?.keys)).toBe(true);
    expect(Object.getPrototypeOf(env.googleBusinessProfile.tokenEncryptionKeyring?.keys)).toBe(
      null,
    );
  });

  it.each([
    ['GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID', 'primary', undefined],
    [
      'GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS',
      undefined,
      JSON.stringify({ primary: validEncryptionKey }),
    ],
  ] as const)(
    'rejects a partial keyring when only %s is present',
    (_presentName, activeKeyId, encodedKeys) => {
      if (activeKeyId === undefined) {
        delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID;
      } else {
        process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID = activeKeyId;
      }
      if (encodedKeys === undefined) {
        delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS;
      } else {
        process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS = encodedKeys;
      }
      resetEnvCache();

      expect(captureEnvErrorMessage()).toContain('GOOGLE_BUSINESS_TOKEN_ENCRYPTION_');
    },
  );

  it.each([
    ['malformed JSON', '{not-json'],
    ['an empty keyring', '{}'],
    ['a short decoded key', JSON.stringify({ primary: 'c2hvcnQ' })],
    [
      'non-canonical base64url key material',
      JSON.stringify({ primary: `${validEncryptionKey.slice(0, -1)}d` }),
    ],
  ] as const)('rejects %s without echoing key material', (_scenario, encodedKeys) => {
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'primary';
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS = encodedKeys;
    resetEnvCache();

    const message = captureEnvErrorMessage();
    expect(message).toContain('GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS');
    expect(message).not.toContain(encodedKeys);
  });

  it('rejects an active key identifier that is absent from the keyring', () => {
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'missing';
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS = JSON.stringify({
      primary: validEncryptionKey,
    });
    resetEnvCache();

    expect(captureEnvErrorMessage()).toContain('GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID');
  });

  it('rejects duplicate key identifiers before JSON normalization can discard one', () => {
    const otherEncryptionKey = Buffer.alloc(32, 9).toString('base64url');
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'primary';
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS = `{"primary":"${validEncryptionKey}","primary":"${otherEncryptionKey}"}`;
    resetEnvCache();

    const message = captureEnvErrorMessage();
    expect(message).toContain('GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS');
    expect(message).not.toContain(validEncryptionKey);
    expect(message).not.toContain(otherEncryptionKey);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty'] as const)(
    'directly rejects inherited active key identifier %s',
    (activeKeyId) => {
      const result = envSchemas.test.safeParse({
        ...directTestEnv,
        GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID: activeKeyId,
        GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS: JSON.stringify({
          primary: validEncryptionKey,
        }),
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        'GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID',
      ]);
    },
  );

  it('directly rejects an own __proto__ key instead of dropping it', () => {
    const result = envSchemas.test.safeParse({
      ...directTestEnv,
      GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID: '__proto__',
      GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS: `{"__proto__":"${validEncryptionKey}"}`,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      'GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS',
    ]);
  });

  it('directly rejects duplicate top-level key identifiers', () => {
    const result = envSchemas.test.safeParse({
      ...directTestEnv,
      GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID: 'primary',
      GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS: `{"primary":"${validEncryptionKey}","primary":"${validEncryptionKey}"}`,
    });

    expect(result.success).toBe(false);
  });

  it('rejects key identifiers outside the bounded identifier format', () => {
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'invalid key id';
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS = JSON.stringify({
      'invalid key id': validEncryptionKey,
    });
    resetEnvCache();

    expect(captureEnvErrorMessage()).toContain('GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID');
  });

  it('requires complete Pub/Sub verification metadata when ingestion is enabled', () => {
    process.env.GBP_PUBSUB_INGEST_ENABLED = 'true';
    delete process.env.GBP_PUBSUB_EXPECTED_AUDIENCE;
    delete process.env.GBP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GBP_PUBSUB_SUBSCRIPTION;
    delete process.env.GBP_PUBSUB_TOPIC;
    resetEnvCache();

    const message = captureEnvErrorMessage();
    expect(message).toContain('GBP_PUBSUB_EXPECTED_AUDIENCE');
    expect(message).toContain('GBP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL');
    expect(message).toContain('GBP_PUBSUB_SUBSCRIPTION');
    expect(message).toContain('GBP_PUBSUB_TOPIC');
  });

  it('normalizes valid Pub/Sub ingress configuration', () => {
    process.env.GBP_PUBSUB_INGEST_ENABLED = 'true';
    process.env.GBP_PUBSUB_EXPECTED_AUDIENCE = 'https://nabatable.example.com/api/pubsub/gbp';
    process.env.GBP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL =
      'gbp-push@example-project.iam.gserviceaccount.com';
    process.env.GBP_PUBSUB_SUBSCRIPTION =
      'projects/example-project/subscriptions/gbp-profile-updates';
    process.env.GBP_PUBSUB_TOPIC = 'projects/example-project/topics/gbp-profile-updates';
    resetEnvCache();

    expect(env.dualSync.pubsubIngress).toEqual({
      enabled: true,
      expectedAudience: 'https://nabatable.example.com/api/pubsub/gbp',
      pushServiceAccountEmail: 'gbp-push@example-project.iam.gserviceaccount.com',
      subscription: 'projects/example-project/subscriptions/gbp-profile-updates',
      topic: 'projects/example-project/topics/gbp-profile-updates',
    });
  });

  it.each([
    ['GBP_PUBSUB_EXPECTED_AUDIENCE', 'not-a-url'],
    ['GBP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL', 'not-an-email'],
    ['GBP_PUBSUB_SUBSCRIPTION', 'subscriptions/missing-project'],
    ['GBP_PUBSUB_SUBSCRIPTION', 'projects/example-project/subscriptions/goog-reserved'],
    ['GBP_PUBSUB_TOPIC', 'projects/example-project/subscriptions/wrong-kind'],
    ['GBP_PUBSUB_TOPIC', 'projects/example-project/topics/goog-reserved'],
  ] as const)('rejects malformed optional Pub/Sub setting %s', (name, value) => {
    process.env.GBP_PUBSUB_INGEST_ENABLED = 'false';
    process.env[name] = value;
    resetEnvCache();

    expect(captureEnvErrorMessage()).toContain(name);
  });
});

export {};
