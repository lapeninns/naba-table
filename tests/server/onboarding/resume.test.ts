import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequestUserMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getOnboardingReadinessMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/request-user', () => ({ getRequestUser: getRequestUserMock }));
vi.mock('@/server/team/access', () => ({ fetchUserMemberships: fetchUserMembershipsMock }));
vi.mock('@/server/onboarding/readiness', () => ({
  getOnboardingReadiness: getOnboardingReadinessMock,
}));
vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: maybeSingleMock,
      };
      return chain;
    },
  }),
}));

import { loadOnboardingResume } from '@/server/onboarding/resume';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const USER = { id: 'user-1', email: 'owner@example.com' };

beforeEach(() => {
  getRequestUserMock.mockReset();
  fetchUserMembershipsMock.mockReset().mockResolvedValue([]);
  getOnboardingReadinessMock.mockReset();
  maybeSingleMock.mockReset().mockResolvedValue({
    data: { id: RESTAURANT_ID, name: 'The Local', slug: 'the-local', timezone: 'Europe/London' },
    error: null,
  });
});

describe('loadOnboardingResume', () => {
  it('reports a signed-out visitor', async () => {
    getRequestUserMock.mockResolvedValue({ user: null, error: null });

    await expect(loadOnboardingResume()).resolves.toEqual({
      session: null,
      memberRestaurantIds: [],
      resumeRestaurant: null,
    });
    expect(fetchUserMembershipsMock).not.toHaveBeenCalled();
  });

  it('reports a confirmed session with no restaurant yet', async () => {
    getRequestUserMock.mockResolvedValue({ user: USER, error: null });

    await expect(loadOnboardingResume()).resolves.toEqual({
      session: { email: 'owner@example.com' },
      memberRestaurantIds: [],
      resumeRestaurant: null,
    });
  });

  it('resumes the owner’s only restaurant while setup is incomplete', async () => {
    getRequestUserMock.mockResolvedValue({ user: USER, error: null });
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'owner' }]);
    getOnboardingReadinessMock.mockResolvedValue({ ready: false, missing: ['tables'] });

    const resume = await loadOnboardingResume();

    expect(resume?.resumeRestaurant).toEqual({
      id: RESTAURANT_ID,
      name: 'The Local',
      slug: 'the-local',
      timezone: 'Europe/London',
    });
  });

  it('does not resume a restaurant that is already set up or not administered', async () => {
    getRequestUserMock.mockResolvedValue({ user: USER, error: null });
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'owner' }]);
    getOnboardingReadinessMock.mockResolvedValue({ ready: true, missing: [] });
    await expect(loadOnboardingResume()).resolves.toMatchObject({
      memberRestaurantIds: [RESTAURANT_ID],
      resumeRestaurant: null,
    });

    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'host' }]);
    getOnboardingReadinessMock.mockClear();
    await expect(loadOnboardingResume()).resolves.toMatchObject({ resumeRestaurant: null });
    expect(getOnboardingReadinessMock).not.toHaveBeenCalled();
  });

  it('falls back to the draft (undefined) when the lookup fails', async () => {
    getRequestUserMock.mockResolvedValue({ user: USER, error: null });
    fetchUserMembershipsMock.mockRejectedValue(new Error('network'));

    await expect(loadOnboardingResume()).resolves.toBeUndefined();
  });
});
