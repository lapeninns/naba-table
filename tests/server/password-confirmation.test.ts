import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';

describe('password confirmation', () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    createClientMock.mockReset();

    createClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signOut: signOutMock,
      },
    });

    signInWithPasswordMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue({ error: null });
  });

  it('signs out only the temporary local confirmation session', async () => {
    await expect(
      verifyUserPasswordConfirmation({
        email: 'owner@example.com',
        password: 'OldCrown@2025',
      }),
    ).resolves.toBeUndefined();

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'OldCrown@2025',
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not trim the submitted password before verification', async () => {
    await expect(
      verifyUserPasswordConfirmation({
        email: 'owner@example.com',
        password: '  exact password  ',
      }),
    ).resolves.toBeUndefined();

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: '  exact password  ',
    });
  });

  it('returns a stable error for incorrect passwords', async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      error: new Error('Invalid login credentials'),
    });

    await expect(
      verifyUserPasswordConfirmation({
        email: 'owner@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject<Partial<PasswordConfirmationError>>({
      code: 'PASSWORD_CONFIRMATION_FAILED',
      status: 403,
    });
  });
});
