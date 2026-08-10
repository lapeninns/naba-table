import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCredentialRowMock = vi.hoisted(() => vi.fn());
const findExternalProfileMock = vi.hoisted(() => vi.fn());
const createOAuthAttemptMock = vi.hoisted(() => vi.fn());
const readOAuthAttemptByHashMock = vi.hoisted(() => vi.fn());
const completeOAuthIdentityMock = vi.hoisted(() => vi.fn());
const upsertCredentialMock = vi.hoisted(() => vi.fn());
const decryptSecretMock = vi.hoisted(() => vi.fn());
const encryptSecretMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  getCredentialRow: getCredentialRowMock,
  findExternalProfile: findExternalProfileMock,
  createOAuthAttempt: createOAuthAttemptMock,
  readOAuthAttemptByHash: readOAuthAttemptByHashMock,
  completeOAuthIdentity: completeOAuthIdentityMock,
  upsertCredential: upsertCredentialMock,
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  decryptGoogleBusinessProfileSecret: decryptSecretMock,
  encryptGoogleBusinessProfileSecret: encryptSecretMock,
}));

vi.mock('@/server/team/access', () => {
  class MembershipAccessError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(params: { status: number; code: string; message: string }) {
      super(params.message);
      this.name = 'MembershipAccessError';
      this.status = params.status;
      this.code = params.code;
    }
  }

  return {
    MembershipAccessError,
    requireAdminMembership: requireAdminMembershipMock,
  };
});

import {
  consumeOAuthStateRecord,
  createOAuthStateRecord,
  saveGoogleBusinessProfileCredentials,
} from '@/server/google-business-profile/serviceAuthorizationFlow';
import { MembershipAccessError } from '@/server/team/access';

import type {
  GoogleBusinessProfileIdentity,
  GoogleBusinessProfileTokens,
} from '@/server/google-business-profile/client';

function tokens(overrides: Partial<GoogleBusinessProfileTokens> = {}): GoogleBusinessProfileTokens {
  return {
    accessToken: 'access-token',
    expiresIn: 3600,
    refreshToken: 'refresh-token',
    grantedScopes: ['scope-a'],
    tokenType: 'Bearer',
    idToken: null,
    ...overrides,
  };
}

function identity(
  overrides: Partial<GoogleBusinessProfileIdentity> = {},
): GoogleBusinessProfileIdentity {
  return {
    providerUserId: 'google-user-1',
    email: 'owner@example.com',
    name: 'Owner',
    ...overrides,
  };
}

function oauthState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'state-1',
    restaurant_id: 'rest-1',
    requested_by_user_id: 'user-1',
    consumed_at: null,
    expires_at: '2999-01-01T00:00:00.000Z',
    return_path: '/app/settings/restaurant/google-business-profile',
    ...overrides,
  };
}

describe('google business profile service authorization flow', () => {
  beforeEach(() => {
    getCredentialRowMock.mockReset();
    findExternalProfileMock.mockReset();
    createOAuthAttemptMock.mockReset();
    readOAuthAttemptByHashMock.mockReset();
    completeOAuthIdentityMock.mockReset();
    upsertCredentialMock.mockReset();
    decryptSecretMock.mockReset();
    encryptSecretMock.mockReset();
    requireAdminMembershipMock.mockReset();

    encryptSecretMock.mockImplementation((value: string) => `enc:${value}`);
  });

  it('fails closed for the retired direct credential persistence path', async () => {
    getCredentialRowMock.mockResolvedValue(null);

    await expect(
      saveGoogleBusinessProfileCredentials(
        {
          externalProfile: { id: 'external-1' } as never,
          tokens: tokens({ refreshToken: 'new-refresh-token' }),
          identity: identity(),
          refreshedAt: '2026-05-21T22:00:00.000Z',
        },
        {} as never,
      ),
    ).rejects.toMatchObject({ code: 'GBP_LEGACY_CREDENTIAL_WRITE_RETIRED', status: 409 });

    expect(upsertCredentialMock).not.toHaveBeenCalled();
  });

  it('creates a hash-only OAuth attempt through the fenced RPC', async () => {
    findExternalProfileMock.mockResolvedValue(null);
    createOAuthAttemptMock.mockResolvedValue(oauthState());
    await expect(
      createOAuthStateRecord(
        {
          restaurantId: 'rest-1',
          requestedByUserId: 'user-1',
          returnPath: 'https://evil.example/callback',
          stateToken: 'state-token',
          expiresAt: '2026-05-21T22:15:00.000Z',
        },
        {} as never,
      ),
    ).resolves.toBe('state-token');

    expect(createOAuthAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_restaurant_id: 'rest-1',
        p_requested_by_user_id: 'user-1',
        p_return_path: '/app/settings/restaurant/google-business-profile',
        p_expires_at: '2026-05-21T22:15:00.000Z',
        p_external_profile_row_id: null,
        p_connection_generation: 1,
        p_consent_epoch: 1,
        p_state_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_nonce_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      {},
    );
  });

  it('consumes OAuth state after membership verification', async () => {
    findExternalProfileMock.mockResolvedValue(null);
    readOAuthAttemptByHashMock.mockResolvedValue(oauthState());
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });

    await expect(
      consumeOAuthStateRecord(
        {
          stateToken: 'state-token',
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
          consumedAt: '2026-05-21T22:00:00.000Z',
        },
        {} as never,
      ),
    ).resolves.toMatchObject({ id: 'state-1' });

    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'user-1',
      restaurantId: 'rest-1',
      client: {},
    });
    expect(readOAuthAttemptByHashMock).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      {},
    );
  });

  it('propagates an atomic OAuth consume rejection without membership side effects', async () => {
    findExternalProfileMock.mockResolvedValue(null);
    readOAuthAttemptByHashMock.mockRejectedValue(new Error('stale OAuth attempt'));
    await expect(
      consumeOAuthStateRecord(
        {
          stateToken: 'state-token',
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
          consumedAt: '2026-05-21T22:00:00.000Z',
        },
        {} as never,
      ),
    ).rejects.toThrow('stale OAuth attempt');
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
  });

  it('maps membership access errors to stable Google Business Profile errors', async () => {
    findExternalProfileMock.mockResolvedValue(null);
    readOAuthAttemptByHashMock.mockResolvedValue(oauthState());
    requireAdminMembershipMock.mockRejectedValue(
      new MembershipAccessError({
        status: 403,
        code: 'MEMBERSHIP_ROLE_DENIED',
        message: 'Role denied.',
      }),
    );

    await expect(
      consumeOAuthStateRecord(
        {
          stateToken: 'state-token',
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
          consumedAt: '2026-05-21T22:00:00.000Z',
        },
        {} as never,
      ),
    ).rejects.toMatchObject({
      code: 'GBP_STATE_RESTAURANT_FORBIDDEN',
      status: 403,
      message:
        'You no longer have permission to connect Google Business Profile for this restaurant.',
    });

    expect(readOAuthAttemptByHashMock).toHaveBeenCalledTimes(1);
  });
});
