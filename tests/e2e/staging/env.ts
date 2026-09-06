import {
  assertNotProductionTarget,
  requireStagingUrl,
} from '../../../scripts/deploy/staging-hosts';

/**
 * Staging proof environment. Resolved once at Playwright config load so a misconfigured
 * run fails before any browser starts. Values are never printed; only names are reported.
 */
export const STAGING_URL_ENV = ['STAGING_PUBLIC_URL', 'STAGING_OPS_URL'] as const;

export const STAGING_REQUIRED_ENV = [
  ...STAGING_URL_ENV,
  'MONITORING_TOKEN',
  'NABATABLE_SOURCE_REVISION',
  'STAGING_SYNTHETIC_TENANT_ID',
  'STAGING_SYNTHETIC_TENANT_SLUG',
  'STAGING_SYNTHETIC_TENANT_B_ID',
  'STAGING_SYNTHETIC_TENANT_B_SLUG',
  'STAGING_SYNTHETIC_GUEST_EMAIL',
  'STAGING_SYNTHETIC_GUEST_PHONE',
] as const;

/** Optional inputs that unlock additional proofs; specs skip with a reason when absent. */
export const STAGING_OPTIONAL_ENV = [
  'STAGING_SHORT_LINKS_URL',
  'STAGING_SHORT_LINKS_INTERNAL_TOKEN',
  'STAGING_EMAIL_GATEWAY_URL',
  'STAGING_EMAIL_GATEWAY_INTERNAL_TOKEN',
  'STAGING_SMS_GATEWAY_URL',
  'STAGING_SMS_GATEWAY_INTERNAL_TOKEN',
  'STAGING_TWILIO_AUTH_TOKEN',
  'STAGING_SUPABASE_URL',
  'STAGING_SUPABASE_ANON_KEY',
  'STAGING_TENANT_B_ACCESS_TOKEN',
  'STAGING_DELIVERY_SINK_URL',
  'STAGING_EMAIL_MOCK_VERIFIED',
  'STAGING_SMS_SINK_VERIFIED',
  'STAGING_SMS_PROOF_DATE',
] as const;

export type StagingEnv = {
  readonly publicUrl: string;
  readonly opsUrl: string;
  readonly monitoringToken: string;
  readonly expectedRevision: string;
  readonly tenantA: { readonly id: string; readonly slug: string };
  readonly tenantB: { readonly id: string; readonly slug: string };
  readonly guest: { readonly email: string; readonly phone: string };
  readonly optional: Readonly<Record<(typeof STAGING_OPTIONAL_ENV)[number], string | undefined>>;
};

export function resolveStagingEnv(env: NodeJS.ProcessEnv = process.env): StagingEnv {
  // Host guard first: a production URL must fail even when everything else is missing.
  for (const name of STAGING_URL_ENV) {
    const value = env[name]?.trim();
    if (value) assertNotProductionTarget(name, value);
  }
  const missing = STAGING_REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Staging proofs require env: ${missing.join(', ')}`);
  }
  const expectedRevision = env.NABATABLE_SOURCE_REVISION?.trim() ?? '';
  if (!/^[0-9a-f]{40}$/u.test(expectedRevision)) {
    throw new Error('NABATABLE_SOURCE_REVISION must be the 40-hex SHA under test.');
  }
  const optional = Object.fromEntries(
    STAGING_OPTIONAL_ENV.map((name) => {
      const value = env[name]?.trim() || undefined;
      if (value && name.endsWith('_URL')) assertNotProductionTarget(name, value);
      return [name, value];
    }),
  ) as StagingEnv['optional'];
  const guestEmail = env.STAGING_SYNTHETIC_GUEST_EMAIL?.trim() ?? '';
  if (!/@(?:example\.(?:com|org|net)|.*\.test|.*\.invalid)$/iu.test(guestEmail)) {
    throw new Error(
      'STAGING_SYNTHETIC_GUEST_EMAIL must use a reserved test domain (example.com, .test, .invalid) so no real inbox can receive staging mail.',
    );
  }
  return {
    publicUrl: requireStagingUrl(env, 'STAGING_PUBLIC_URL'),
    opsUrl: requireStagingUrl(env, 'STAGING_OPS_URL'),
    monitoringToken: env.MONITORING_TOKEN?.trim() ?? '',
    expectedRevision,
    tenantA: {
      id: env.STAGING_SYNTHETIC_TENANT_ID?.trim() ?? '',
      slug: env.STAGING_SYNTHETIC_TENANT_SLUG?.trim() ?? '',
    },
    tenantB: {
      id: env.STAGING_SYNTHETIC_TENANT_B_ID?.trim() ?? '',
      slug: env.STAGING_SYNTHETIC_TENANT_B_SLUG?.trim() ?? '',
    },
    guest: { email: guestEmail, phone: env.STAGING_SYNTHETIC_GUEST_PHONE?.trim() ?? '' },
    optional,
  };
}

let cached: StagingEnv | null = null;

export function stagingEnv(): StagingEnv {
  cached ??= resolveStagingEnv();
  return cached;
}

export function futureBookingDate(daysAhead = 2): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}
