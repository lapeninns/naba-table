import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

import { GET } from '@/src/app/api/config/service-policy/route';

const POLICY_ROW = {
  lunch_start: '12:00',
  lunch_end: '15:00',
  dinner_start: '17:00',
  dinner_end: '23:00',
  clean_buffer_minutes: 15,
  allow_after_hours: false,
};

function policyQueryClient(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, limit };
}

describe('GET /api/config/service-policy', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
  });

  it('@api returns the mapped service policy on the happy path', async () => {
    const query = policyQueryClient({ data: POLICY_ROW, error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(query.client);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      policy: {
        lunch: { start: '12:00', end: '15:00' },
        dinner: { start: '17:00', end: '23:00' },
        cleanBufferMinutes: 15,
        allowAfterHours: false,
      },
    });
  });

  it('@api @security reads through the RLS-scoped route-handler client and the service_policy table', async () => {
    const query = policyQueryClient({ data: POLICY_ROW, error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(query.client);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getRouteHandlerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(query.from).toHaveBeenCalledWith('service_policy');
    expect(query.select).toHaveBeenCalledWith(
      'lunch_start, lunch_end, dinner_start, dinner_end, clean_buffer_minutes, allow_after_hours',
    );
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it('@api returns 404 when no service policy row is configured', async () => {
    const query = policyQueryClient({ data: null, error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(query.client);

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Service policy not configured.',
      code: 'SERVICE_POLICY_NOT_CONFIGURED',
      message: 'Service policy not configured.',
    });
  });

  it('@api @security returns a generic 500 on database errors without leaking details', async () => {
    const query = policyQueryClient({
      data: null,
      error: { message: 'permission denied for table service_policy', code: '42501' },
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(query.client);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to load service policy',
      code: 'INTERNAL_ERROR',
      message: 'Failed to load service policy',
    });
    expect(JSON.stringify(body)).not.toContain('permission denied');
  });

  it('@api returns a generic 500 when the supabase client cannot be created', async () => {
    getRouteHandlerSupabaseClientMock.mockRejectedValue(new Error('cookie store unavailable'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(body)).not.toContain('cookie store unavailable');
  });
});
