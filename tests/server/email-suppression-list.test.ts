import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertMock = vi.hoisted(() => vi.fn());
const inMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn(() => ({ in: inMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ upsert: upsertMock, select: selectMock })));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ from: fromMock }),
}));

import {
  addEmailToSuppressionList,
  getEmailSuppressionStates,
  getSuppressedEmailsFromList,
  isEmailSuppressed,
} from '@/server/emails/email-suppression-list';

beforeEach(() => {
  upsertMock.mockReset();
  inMock.mockReset();
  selectMock.mockClear();
  fromMock.mockClear();
});

describe('addEmailToSuppressionList', () => {
  it('upserts the normalized email with reason and conflict target', async () => {
    upsertMock.mockResolvedValue({ error: null });

    const result = await addEmailToSuppressionList('  Guest@Example.COM ', 'one_click');

    expect(result).toEqual({ suppressed: true });
    expect(fromMock).toHaveBeenCalledWith('email_unsubscribes');
    const [row, options] = upsertMock.mock.calls[0];
    expect(row).toMatchObject({ email: 'guest@example.com', reason: 'one_click' });
    expect(options).toEqual({ onConflict: 'email' });
  });

  it('no-ops for an unusable email', async () => {
    const result = await addEmailToSuppressionList('   ', 'manual');
    expect(result).toEqual({ suppressed: false });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('throws when the upsert fails', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } });
    await expect(addEmailToSuppressionList('guest@example.com', 'bounce')).rejects.toThrow(/boom/);
  });
});

describe('getEmailSuppressionStates', () => {
  it('partitions addresses into hard (bounce/complaint/manual) and soft (one_click)', async () => {
    inMock.mockResolvedValue({
      data: [
        { email: 'bounce@x.com', reason: 'bounce' },
        { email: 'spam@x.com', reason: 'complaint' },
        { email: 'blocked@x.com', reason: 'manual' },
        { email: 'optout@x.com', reason: 'one_click' },
      ],
      error: null,
    });

    const states = await getEmailSuppressionStates([
      'bounce@x.com',
      'spam@x.com',
      'blocked@x.com',
      'optout@x.com',
    ]);

    expect(states.hard.sort()).toEqual(['blocked@x.com', 'bounce@x.com', 'spam@x.com']);
    expect(states.soft).toEqual(['optout@x.com']);
    expect(selectMock).toHaveBeenCalledWith('email, reason');
  });

  it('short-circuits with no query when given no usable emails', async () => {
    const states = await getEmailSuppressionStates(['', '   ']);
    expect(states).toEqual({ hard: [], soft: [] });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws when the lookup fails', async () => {
    inMock.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await expect(getEmailSuppressionStates(['guest@example.com'])).rejects.toThrow(/db down/);
  });
});

describe('getSuppressedEmailsFromList', () => {
  it('returns the union of hard and soft suppressed addresses (normalized)', async () => {
    inMock.mockResolvedValue({
      data: [
        { email: 'a@b.com', reason: 'bounce' },
        { email: 'c@d.com', reason: 'one_click' },
      ],
      error: null,
    });

    const result = await getSuppressedEmailsFromList(['A@B.com', 'C@D.com', 'e@f.com']);
    expect(result.sort()).toEqual(['a@b.com', 'c@d.com']);
  });
});

describe('isEmailSuppressed', () => {
  it('is true when the email is on the list (any tier)', async () => {
    inMock.mockResolvedValue({ data: [{ email: 'guest@example.com', reason: 'one_click' }], error: null });
    expect(await isEmailSuppressed('Guest@Example.com')).toBe(true);
  });

  it('is false when the email is absent', async () => {
    inMock.mockResolvedValue({ data: [], error: null });
    expect(await isEmailSuppressed('guest@example.com')).toBe(false);
  });
});
