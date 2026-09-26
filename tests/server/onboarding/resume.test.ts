import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequestUserMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getOnboardingReadinessMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const tableResults = vi.hoisted(
  () => new Map<string, { data: unknown[] | null; error: { code: string } | null }>(),
);
const tableFilters = vi.hoisted(() => new Map<string, Array<[string, unknown]>>());

vi.mock('@/server/auth/request-user', () => ({ getRequestUser: getRequestUserMock }));
vi.mock('@/server/team/access', () => ({ fetchUserMemberships: fetchUserMembershipsMock }));
vi.mock('@/server/onboarding/readiness', () => ({
  getOnboardingReadiness: getOnboardingReadinessMock,
}));
vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      tableFilters.set(table, filters);
      const result = () => tableResults.get(table) ?? { data: [], error: null };
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        },
        order: () => chain,
        maybeSingle: maybeSingleMock,
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve, reject),
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
  tableResults.clear();
  tableFilters.clear();
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

    expect(resume?.resumeRestaurant).toMatchObject({
      id: RESTAURANT_ID,
      name: 'The Local',
      slug: 'the-local',
      timezone: 'Europe/London',
    });
  });

  it('returns the saved setup so a resumed wizard does not overwrite it with defaults', async () => {
    getRequestUserMock.mockResolvedValue({ user: USER, error: null });
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'owner' }]);
    getOnboardingReadinessMock.mockResolvedValue({ ready: false, missing: ['tables'] });
    tableResults.set('restaurant_operating_hours', {
      data: [
        { day_of_week: 1, opens_at: '12:00:00', closes_at: '22:00:00', is_closed: false, notes: null },
      ],
      error: null,
    });
    tableResults.set('restaurant_service_periods', {
      data: [
        {
          id: 'sp-1',
          name: 'Dinner',
          day_of_week: null,
          start_time: '17:00:00',
          end_time: '22:00:00',
          booking_option: 'dinner',
        },
      ],
      error: null,
    });
    tableResults.set('zones', {
      data: [{ id: 'zone-1', name: 'Terrace', sort_order: 0, active: true }],
      error: null,
    });
    tableResults.set('table_inventory', {
      data: [{ id: 'table-1', table_number: 'T7', capacity: 4, zone_id: 'zone-1' }],
      error: null,
    });

    const resume = await loadOnboardingResume();
    const setup = resume?.resumeRestaurant?.setup;

    expect(setup?.operatingHours).toHaveLength(7);
    expect(setup?.operatingHours[1]).toEqual({
      dayOfWeek: 1,
      opensAt: '12:00',
      closesAt: '22:00',
      isClosed: false,
      notes: null,
    });
    expect(setup?.operatingHours[0]).toMatchObject({ dayOfWeek: 0, isClosed: true });
    expect(setup?.servicePeriods).toEqual([
      {
        id: 'sp-1',
        name: 'Dinner',
        dayOfWeek: null,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);
    expect(setup?.zones).toEqual([{ id: 'zone-1', name: 'Terrace', sortOrder: 0, active: true }]);
    expect(setup?.tables).toEqual([
      { id: 'table-1', tableNumber: 'T7', capacity: 4, zoneId: 'zone-1' },
    ]);
    for (const table of ['restaurant_operating_hours', 'restaurant_service_periods', 'zones', 'table_inventory']) {
      expect(tableFilters.get(table)).toContainEqual(['restaurant_id', RESTAURANT_ID]);
    }
    expect(tableFilters.get('restaurant_operating_hours')).toContainEqual(['effective_date', null]);
  });

  it('marks the setup unavailable (null) when a read fails', async () => {
    getRequestUserMock.mockResolvedValue({ user: USER, error: null });
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'owner' }]);
    getOnboardingReadinessMock.mockResolvedValue({ ready: false, missing: ['tables'] });
    tableResults.set('zones', { data: null, error: { code: '42501' } });

    const resume = await loadOnboardingResume();

    expect(resume?.resumeRestaurant?.id).toBe(RESTAURANT_ID);
    expect(resume?.resumeRestaurant?.setup).toBeNull();
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
