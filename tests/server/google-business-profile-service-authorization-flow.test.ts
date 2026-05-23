import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCredentialRowMock = vi.hoisted(() => vi.fn());
const insertOAuthStateMock = vi.hoisted(() => vi.fn());
const markOAuthStateConsumedMock = vi.hoisted(() => vi.fn());
const readOAuthStateByTokenMock = vi.hoisted(() => vi.fn());
const upsertCredentialMock = vi.hoisted(() => vi.fn());
const decryptSecretMock = vi.hoisted(() => vi.fn());
const encryptSecretMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  getCredentialRow: getCredentialRowMock,
  insertOAuthState: insertOAuthStateMock,
  markOAuthStateConsumed: markOAuthStateConsumedMock,
  readOAuthStateByToken: readOAuthStateByTokenMock,
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
    insertOAuthStateMock.mockReset();
    markOAuthStateConsumedMock.mockReset();
    readOAuthStateByTokenMock.mockReset();
    upsertCredentialMock.mockReset();
    decryptSecretMock.mockReset();
    encryptSecretMock.mockReset();
    requireAdminMembershipMock.mockReset();

    encryptSecretMock.mockImplementation((value: string) => `enc:${value}`);
  });

  it('saves credentials with a newly issued refresh token', async () => {
    getCredentialRowMock.mockResolvedValue(null);

    await saveGoogleBusinessProfileCredentials(
      {
        externalProfile: { id: 'external-1' } as never,
        tokens: tokens({ refreshToken: 'new-refresh-token' }),
        identity: identity(),
        refreshedAt: '2026-05-21T22:00:00.000Z',
      },
      {} as never,
    );

    expect(decryptSecretMock).not.toHaveBeenCalled();
    expect(encryptSecretMock).toHaveBeenCalledWith('new-refresh-token');
    expect(upsertCredentialMock).toHaveBeenCalledWith(
      {
        external_profile_id: 'external-1',
        provider_user_id: 'google-user-1',
        connected_google_email: 'owner@example.com',
        connected_google_name: 'Owner',
        refresh_token_encrypted: 'enc:new-refresh-token',
        granted_scopes: ['scope-a'],
        token_type: 'Bearer',
        last_refreshed_at: '2026-05-21T22:00:00.000Z',
        last_error: null,
      },
      {},
    );
  });

  it('falls back to an existing stored refresh token when Google does not issue one', async () => {
    getCredentialRowMock.mockResolvedValue({
      refresh_token_encrypted: 'encrypted-existing-refresh',
    });
    decryptSecretMock.mockReturnValue('existing-refresh-token');

    await saveGoogleBusinessProfileCredentials(
      {
        externalProfile: { id: 'external-1' } as never,
        tokens: tokens({ refreshToken: null }),
        identity: identity({ email: null, name: null }),
        refreshedAt: '2026-05-21T22:00:00.000Z',
      },
      {} as never,
    );

    expect(decryptSecretMock).toHaveBeenCalledWith('encrypted-existing-refresh');
    expect(encryptSecretMock).toHaveBeenCalledWith('existing-refresh-token');
    expect(upsertCredentialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_token_encrypted: 'enc:existing-refresh-token',
        connected_google_email: null,
        connected_google_name: null,
      }),
      {},
    );
  });

  it('creates OAuth state records through the sanitized payload builder', async () => {
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

    expect(insertOAuthStateMock).toHaveBeenCalledWith(
      {
        restaurant_id: 'rest-1',
        provider: 'google_business_profile',
        requested_by_user_id: 'user-1',
        state_token: 'state-token',
        return_path: '/app/settings/restaurant/google-business-profile',
        expires_at: '2026-05-21T22:15:00.000Z',
      },
      {},
    );
  });

  it('consumes OAuth state after membership verification', async () => {
    readOAuthStateByTokenMock.mockResolvedValue(oauthState());
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    markOAuthStateConsumedMock.mockResolvedValue(true);

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
    expect(markOAuthStateConsumedMock).toHaveBeenCalledWith(
      {
        stateId: 'state-1',
        payload: { consumed_at: '2026-05-21T22:00:00.000Z' },
      },
      {},
    );
  });

  it('maps membership access errors to stable Google Business Profile errors', async () => {
    readOAuthStateByTokenMock.mockResolvedValue(oauthState());
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

    expect(markOAuthStateConsumedMock).not.toHaveBeenCalled();
  });
});
