import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { getSuppressedRecipientEmails, suppressProfilesByEmail } from '@/server/emails/recipient-suppression';

function createProfilesSelectMock(data: unknown, error: unknown = null) {
  return {
    in: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createUserProfilesSelectMock(data: unknown, error: unknown = null) {
  return {
    in: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createUserProfilesUpdateMock(error: unknown = null) {
  return {
    in: vi.fn().mockResolvedValue({ error }),
  };
}

describe('recipient suppression helpers', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('returns suppressed recipient emails by joining profiles to user_profiles', async () => {
    const profilesSelect = createProfilesSelectMock([
      { id: 'profile-1', email: 'guest@example.com' },
      { id: 'profile-2', email: 'allowed@example.com' },
    ]);
    const userProfilesSelect = createUserProfilesSelectMock([
      { id: 'profile-1', is_email_suppressed: true },
      { id: 'profile-2', is_email_suppressed: false },
    ]);

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profilesSelect) };
        }

        if (table === 'user_profiles') {
          return { select: vi.fn().mockReturnValue(userProfilesSelect) };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(
      getSuppressedRecipientEmails(['Guest@example.com', 'allowed@example.com', 'guest@example.com']),
    ).resolves.toEqual(['guest@example.com']);
  });

  it('updates unsuppressed user_profiles resolved through profiles.email', async () => {
    const profilesSelect = createProfilesSelectMock([
      { id: 'profile-1', email: 'guest@example.com' },
      { id: 'profile-2', email: 'guest@example.com' },
    ]);
    const userProfilesSelect = createUserProfilesSelectMock([
      { id: 'profile-1', is_email_suppressed: false },
      { id: 'profile-2', is_email_suppressed: true },
    ]);
    const userProfilesUpdate = createUserProfilesUpdateMock();
    const fromMock = vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnValue(profilesSelect) };
      }

      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue(userProfilesSelect),
          update: vi.fn().mockReturnValue(userProfilesUpdate),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    getServiceSupabaseClientMock.mockReturnValue({ from: fromMock });

    await expect(suppressProfilesByEmail('guest@example.com')).resolves.toEqual({
      matchedProfiles: 2,
      updatedProfiles: 1,
    });

    expect(userProfilesUpdate.in).toHaveBeenCalledWith('id', ['profile-1']);
  });
});
