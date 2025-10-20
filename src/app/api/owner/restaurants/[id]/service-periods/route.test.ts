import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, PUT } from './route';

const getServicePeriodsMock = vi.fn();
const updateServicePeriodsMock = vi.fn();
const getUserMock = vi.fn();
const requireAdminMembershipMock = vi.fn();
const getOccasionCatalogMock = vi.fn();

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: (...args: unknown[]) => getServicePeriodsMock(...args),
  updateServicePeriods: (...args: unknown[]) => updateServicePeriodsMock(...args),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: (...args: unknown[]) => requireAdminMembershipMock(...args),
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: (...args: unknown[]) => getOccasionCatalogMock(...args),
}));

const defaultCatalog = {
  definitions: [
    {
      key: 'lunch',
      label: 'Lunch',
      shortLabel: 'Lunch',
      description: null,
      availability: [],
      defaultDurationMinutes: 90,
      displayOrder: 10,
      isActive: true,
    },
    {
      key: 'dinner',
      label: 'Dinner',
      shortLabel: 'Dinner',
      description: null,
      availability: [],
      defaultDurationMinutes: 120,
      displayOrder: 20,
      isActive: true,
    },
    {
      key: 'drinks',
      label: 'Drinks',
      shortLabel: 'Drinks',
      description: null,
      availability: [],
      defaultDurationMinutes: 75,
      displayOrder: 30,
      isActive: true,
    },
  ],
  orderedKeys: ['lunch', 'dinner', 'drinks'],
  byKey: new Map([
    [
      'lunch',
      {
        key: 'lunch',
        label: 'Lunch',
        shortLabel: 'Lunch',
        description: null,
        availability: [],
        defaultDurationMinutes: 90,
        displayOrder: 10,
        isActive: true,
      },
    ],
    [
      'dinner',
      {
        key: 'dinner',
        label: 'Dinner',
        shortLabel: 'Dinner',
        description: null,
        availability: [],
        defaultDurationMinutes: 120,
        displayOrder: 20,
        isActive: true,
      },
    ],
    [
      'drinks',
      {
        key: 'drinks',
        label: 'Drinks',
        shortLabel: 'Drinks',
        description: null,
        availability: [],
        defaultDurationMinutes: 75,
        displayOrder: 30,
        isActive: true,
      },
    ],
  ]),
};

describe('/api/owner/restaurants/[id]/service-periods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOccasionCatalogMock.mockResolvedValue(defaultCatalog);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication on GET', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns service periods on GET', async () => {
      definitions: [
        {
          key: 'lunch',
          label: 'Lunch',
          shortLabel: 'Lunch',
          description: null,
          availability: [],
          defaultDurationMinutes: 90,
          displayOrder: 10,
          isActive: true,
        },
        {
          key: 'dinner',
          label: 'Dinner',
          shortLabel: 'Dinner',
          description: null,
          availability: [],
          defaultDurationMinutes: 120,
          displayOrder: 20,
          isActive: true,
        },
        {
          key: 'drinks',
          label: 'Drinks',
          shortLabel: 'Drinks',
          description: null,
          availability: [],
          defaultDurationMinutes: 75,
          displayOrder: 30,
          isActive: true,
        },
      ],
      orderedKeys: ['lunch', 'dinner', 'drinks'],
      byKey: new Map([
        [
          'lunch',
          {
            key: 'lunch',
            label: 'Lunch',
            shortLabel: 'Lunch',
            description: null,
            availability: [],
            defaultDurationMinutes: 90,
            displayOrder: 10,
            isActive: true,
          },
        ],
        [
          'dinner',
          {
            key: 'dinner',
            label: 'Dinner',
            shortLabel: 'Dinner',
            description: null,
            availability: [],
            defaultDurationMinutes: 120,
            displayOrder: 20,
            isActive: true,
          },
        ],
        [
          'drinks',
          {
            key: 'drinks',
            label: 'Drinks',
            shortLabel: 'Drinks',
            description: null,
            availability: [],
            defaultDurationMinutes: 75,
            displayOrder: 30,
            isActive: true,
          },
        ],
      ]),
    });
  });

    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    getServicePeriodsMock.mockResolvedValue([
      {
        id: 'sp-1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
      },
    ]);

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.periods).toHaveLength(1);
    expect(getServicePeriodsMock).toHaveBeenCalledWith('rest-1');
  });

  it('validates payload on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify([
        { name: '', startTime: '10:00', endTime: '12:00', bookingOption: 'lunch' },
      ]),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(400);
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  });

  it('updates service periods on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    updateServicePeriodsMock.mockResolvedValue([
      {
        id: 'sp-1',
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '18:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify([
        {
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '18:00:00',
          endTime: '22:00:00',
          bookingOption: 'dinner',
        },
      ]),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    expect(updateServicePeriodsMock).toHaveBeenCalledWith('rest-1', [
      {
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '18:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);
  });
});
  it('rejects unknown occasions on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify([
        {
          name: 'Festive Night',
          dayOfWeek: 5,
          startTime: '18:00:00',
          endTime: '22:00:00',
          bookingOption: 'holiday_bash',
        },
      ]),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('holiday_bash');
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  });
