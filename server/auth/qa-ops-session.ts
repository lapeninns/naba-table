import type { OpsMembership, OpsUser } from '@/types/ops';

export const QA_OPS_AUTH_COOKIE_NAME = '__nabatable_qa_ops_auth';
export const QA_OPS_AUTH_COOKIE_VALUE = 'enabled';
export const QA_OPS_USER_ID = '99999999-9999-4999-8999-999999999999';
export const QA_OPS_RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'app.localhost']);

export type QaOpsAuthFixtureInput = {
  cookieValue?: string | null;
  env?: NodeJS.ProcessEnv;
  host?: string | null;
};

export type QaOpsAuthFixture = {
  initialRestaurantId: string;
  memberships: OpsMembership[];
  user: OpsUser;
};

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function normalizeHostname(host: string | null | undefined): string {
  const normalized = (host ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('[')) {
    return normalized.slice(1).split(']')[0] ?? '';
  }
  return normalized.split(':')[0] ?? '';
}

function isLocalHost(host: string | null | undefined): boolean {
  const hostname = normalizeHostname(host);
  return LOCAL_HOSTS.has(hostname);
}

export function isQaOpsAuthFixtureAllowed({
  cookieValue,
  env = process.env,
  host,
}: QaOpsAuthFixtureInput): boolean {
  if (cookieValue !== QA_OPS_AUTH_COOKIE_VALUE) return false;
  if (!isTruthy(env.QA_ENABLE_AUTH_FIXTURES)) return false;
  if (!isTruthy(env.QA_USE_MOCKS)) return false;
  if (env.QA_TARGET_ENV !== 'local') return false;
  if (env.APP_ENV === 'production' || env.NODE_ENV === 'production') return false;
  if ((env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost') !== 'localhost') return false;
  return isLocalHost(host);
}

export function getQaOpsAuthFixture(input: QaOpsAuthFixtureInput): QaOpsAuthFixture | null {
  if (!isQaOpsAuthFixtureAllowed(input)) return null;

  return {
    user: {
      id: QA_OPS_USER_ID,
      email: 'qa.ops@example.test',
    },
    memberships: [
      {
        restaurantId: QA_OPS_RESTAURANT_ID,
        restaurantName: 'QA App Host Restaurant',
        restaurantSlug: 'qa-app-host',
        role: 'owner',
        createdAt: '2026-05-16T00:00:00.000Z',
      },
      {
        restaurantId: '22222222-2222-4222-8222-222222222222',
        restaurantName: 'QA Secondary Restaurant',
        restaurantSlug: 'qa-secondary',
        role: 'manager',
        createdAt: '2026-05-16T00:00:00.000Z',
      },
    ],
    initialRestaurantId: QA_OPS_RESTAURANT_ID,
  };
}
