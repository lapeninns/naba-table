import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsSessionProvider, useOpsSession } from '@/contexts/ops-session';
import OpsAppLayout from '@/src/app/app/(app)/layout';

import type { OpsSessionProviderProps } from '@/contexts/ops-session';
import type { ReactElement, ReactNode } from 'react';

const QA_USER_ID = 'qa-ops-user';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => 'localhost:3000' }),
}));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('unexpected redirect');
  },
}));
vi.mock('@/server/auth/qa-ops-session', () => ({
  QA_OPS_AUTH_COOKIE_NAME: 'qa-ops',
  getQaOpsAuthFixture: () => ({
    user: { id: 'qa-ops-user', email: 'qa.ops@example.test' },
    memberships: [],
  }),
}));
vi.mock('@/server/ops/resolve-ops-env-banner', () => ({ resolveOpsEnvBanner: () => null }));
vi.mock('@/server/supabase', () => ({ getServerComponentSupabaseClient: async () => ({}) }));
vi.mock('@/server/team/access', () => ({ fetchUserMembershipsCached: async () => [] }));
vi.mock('@/components/features/ops-shell/OpsShell', () => ({
  OpsShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/contexts/ops-services', () => ({
  OpsServicesProvider: ({ children }: { children: ReactNode }) => children,
}));

function Permissions() {
  const { permissions } = useOpsSession();
  return <span data-testid="platform-admin">{String(permissions.isPlatformAdmin)}</span>;
}

describe('platform-admin session signal', () => {
  beforeEach(() => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', '');
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to false so restaurant staff never see the catalog editor by accident', () => {
    render(
      <OpsSessionProvider user={{ id: 'u', email: null }} memberships={[]}>
        <Permissions />
      </OpsSessionProvider>,
    );
    expect(screen.getByTestId('platform-admin')).toHaveTextContent('false');
  });

  it('exposes the server-computed flag in session permissions', () => {
    render(
      <OpsSessionProvider user={{ id: 'u', email: null }} memberships={[]} isPlatformAdmin>
        <Permissions />
      </OpsSessionProvider>,
    );
    expect(screen.getByTestId('platform-admin')).toHaveTextContent('true');
  });

  it.each([
    ['listed', QA_USER_ID, 'true'],
    ['not listed', 'someone-else', 'false'],
  ])(
    'computes the flag in the ops layout, QA fixture path included (%s)',
    async (_label, listed, expected) => {
      vi.stubEnv('PLATFORM_ADMIN_USER_IDS', listed);

      const tree = (await OpsAppLayout({
        children: <Permissions />,
      })) as ReactElement<OpsSessionProviderProps>;

      expect(tree.props.isPlatformAdmin).toBe(expected === 'true');
      render(tree);
      expect(screen.getByTestId('platform-admin')).toHaveTextContent(expected);
    },
  );
});
