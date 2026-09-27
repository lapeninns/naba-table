import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleConfig = vi.hoisted<{
  tokenEncryptionKey: null;
  tokenEncryptionKeyring: { activeKeyId: string; keys: Record<string, string> };
}>(() => ({
  tokenEncryptionKey: null,
  tokenEncryptionKeyring: { activeKeyId: 'current', keys: {} },
}));
const getCredentialRowMock = vi.hoisted(() => vi.fn());
const completeOAuthIdentityMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({ env: { googleBusinessProfile: googleConfig } }));
vi.mock('@/server/team/access', () => ({
  MembershipAccessError: class extends Error {},
  requireAdminMembership: vi.fn(),
}));
vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  getCredentialRow: getCredentialRowMock,
  completeOAuthIdentity: completeOAuthIdentityMock,
}));

import { createCredentialEnvelope } from '@/server/google-business-profile/credentialEnvelope';
import { decryptGoogleBusinessProfileSecret } from '@/server/google-business-profile/crypto';
import { completeOAuthIdentityRecord } from '@/server/google-business-profile/serviceAuthorizationFlow';

import type { OAuthStateRow } from '@/server/google-business-profile/serviceRepository';
import type { Database } from '@/types/supabase';

const client = createClient<Database>('https://example.supabase.co', 'test-anon-key');
const state: OAuthStateRow = {
  id: 'state-1',
  restaurant_id: 'restaurant-1',
  requested_by_user_id: 'user-1',
  external_profile_row_id: 'profile-1',
  connection_generation: 1,
  consent_epoch: 1,
  consumed_at: null,
  invalidated_at: null,
  invalidation_reason: null,
  expected_external_account_id: null,
  expected_external_location_id: null,
  expected_external_profile_id: null,
  created_at: '2026-09-27T10:00:00.000Z',
  updated_at: '2026-09-27T10:00:00.000Z',
  expires_at: '2026-09-27T10:15:00.000Z',
  return_path: '/app/settings/restaurant/google-business-profile',
  oidc_nonce_hash: 'nonce-hash',
  provider: 'google_business_profile',
  state_hash: 'state-hash',
  state_token: '',
};

function complete(refreshToken: string | null) {
  return completeOAuthIdentityRecord(
    {
      state,
      stateToken: 'state-token',
      requestedByUserId: 'user-1',
      tokens: {
        accessToken: 'test-access-token',
        refreshToken,
        expiresIn: 3600,
        grantedScopes: ['scope-a'],
        tokenType: 'Bearer',
        idToken: null,
      },
      identity: { providerUserId: 'google-user-1', email: 'owner@example.com', name: 'Owner' },
      refreshedAt: '2026-09-27T10:01:00.000Z',
    },
    client,
  );
}

describe('Google OAuth reconnect refresh tokens', () => {
  let oldKey: Buffer;

  beforeEach(() => {
    oldKey = randomBytes(32);
    googleConfig.tokenEncryptionKeyring.keys = { current: randomBytes(32).toString('base64url') };
    getCredentialRowMock.mockResolvedValue({
      refresh_token_encrypted: createCredentialEnvelope('old-refresh-token', {
        keyring: { activeKeyId: 'retired', keys: new Map([['retired', oldKey]]) },
        externalProfileId: 'profile-1',
        column: 'refresh_token_encrypted',
      }),
    });
    completeOAuthIdentityMock.mockImplementation(
      (args: Database['public']['Functions']['complete_gbp_oauth_identity_v1']['Args']) => ({
        id: args.p_target_external_profile_row_id,
        savedRefreshToken: decryptGoogleBusinessProfileSecret(
          args.p_refresh_token_encrypted,
          args.p_target_external_profile_row_id,
        ),
      }),
    );
  });

  it('persists the fresh token when the previous encryption key is unavailable', async () => {
    await expect(complete('new-refresh-token')).resolves.toMatchObject({
      id: 'profile-1',
      savedRefreshToken: 'new-refresh-token',
    });
    expect(completeOAuthIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_requested_by_user_id: 'user-1',
        p_provider_user_id: 'google-user-1',
        p_state_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_nonce_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_refresh_token_encrypted: expect.stringMatching(/^gbp\.1\.current\./),
      }),
      client,
    );
  });

  it('rewraps the stored token when Google omits a new refresh token', async () => {
    googleConfig.tokenEncryptionKeyring.keys['retired'] = oldKey.toString('base64url');

    await expect(complete(null)).resolves.toMatchObject({ savedRefreshToken: 'old-refresh-token' });
    expect(completeOAuthIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_refresh_token_encrypted: expect.stringMatching(/^gbp\.1\.current\./),
      }),
      client,
    );
  });

  it('fails before persistence when fallback needs an unavailable encryption key', async () => {
    await expect(complete(null)).rejects.toMatchObject({
      code: 'GBP_INVALID_ENCRYPTION_KEY',
      status: 500,
    });
    expect(completeOAuthIdentityMock).not.toHaveBeenCalled();
  });

  it('fails before persistence when neither refresh token exists', async () => {
    getCredentialRowMock.mockResolvedValue(null);

    await expect(complete(null)).rejects.toMatchObject({
      code: 'GBP_REFRESH_TOKEN_MISSING',
      status: 409,
    });
    expect(completeOAuthIdentityMock).not.toHaveBeenCalled();
  });
});
