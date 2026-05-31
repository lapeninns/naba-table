import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { markTokenUsed, TokenValidationError } from '@/server/bookings/confirmation-token';

function buildTokenUpdateQuery(result: { data: unknown; error: unknown }) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
}

describe('confirmation token atomic consumption', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('marks unused tokens with a null-used-at guard', async () => {
    const query = buildTokenUpdateQuery({ data: { id: 'booking-1' }, error: null });
    getServiceSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await expect(markTokenUsed('token-1')).resolves.toBeUndefined();

    expect(query.update).toHaveBeenCalledWith({
      confirmation_token_used_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith('confirmation_token', 'token-1');
    expect(query.is).toHaveBeenCalledWith('confirmation_token_used_at', null);
    expect(query.select).toHaveBeenCalledWith('id');
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it('treats a zero-row guarded update as an already-used token', async () => {
    const query = buildTokenUpdateQuery({ data: null, error: null });
    getServiceSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await expect(markTokenUsed('token-1')).rejects.toEqual(
      new TokenValidationError('Token has already been used', 'TOKEN_USED'),
    );
  });
});
