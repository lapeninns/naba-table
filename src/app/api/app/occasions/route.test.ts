import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const fetchAllOccasionsMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('@/server/occasions/admin', () => ({
  fetchAllOccasions: (...args: unknown[]) => fetchAllOccasionsMock(...args),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

describe('/api/app/occasions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when session is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(new NextRequest('http://localhost/api/app/occasions'));

    expect(response.status).toBe(401);
  });

  it('responds with occasion definitions when authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    fetchAllOccasionsMock.mockResolvedValue([
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
    ]);

    const response = await GET(new NextRequest('http://localhost/api/app/occasions'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.occasions).toEqual([
      expect.objectContaining({ key: 'dinner', label: 'Dinner' }),
    ]);
  });
});
