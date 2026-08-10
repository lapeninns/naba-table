import { beforeEach, describe, expect, it, vi } from 'vitest';

const jwtVerifyMock = vi.hoisted(() => vi.fn());

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: jwtVerifyMock,
}));

vi.mock('@/lib/env', () => ({
  env: { googleBusinessProfile: { clientId: 'client-1' } },
}));

import { validateGoogleBusinessProfileIdToken } from '@/server/google-business-profile/clientIdentity';

const validClaims = {
  sub: 'google-user-1',
  nonce: 'nonce-1',
  exp: 2_000_000_000,
  aud: 'client-1',
};

describe('Google Business Profile OIDC identity validation', () => {
  beforeEach(() => {
    jwtVerifyMock.mockReset().mockResolvedValue({ payload: validClaims });
  });

  it('pins jose verification to RS256, Google issuers, client audience, and required claims', async () => {
    const currentDate = new Date('2026-08-09T10:00:00.000Z');

    await validateGoogleBusinessProfileIdToken({
      idToken: 'signed-token',
      expectedNonce: 'nonce-1',
      clientId: 'client-1',
      key: vi.fn(),
      currentDate,
    });

    expect(jwtVerifyMock).toHaveBeenCalledWith(
      'signed-token',
      expect.any(Function),
      expect.objectContaining({
        algorithms: ['RS256'],
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: 'client-1',
        requiredClaims: ['sub', 'exp', 'nonce'],
        currentDate,
      }),
    );
  });

  it.each([
    [{ ...validClaims, nonce: 'wrong' }],
    [{ ...validClaims, aud: ['client-1', 'other'], azp: 'other' }],
    [{ ...validClaims, sub: '' }],
    [{ ...validClaims, email: 'owner@example.com', email_verified: false }],
  ])('rejects invalid identity claims without exposing the token', async (payload) => {
    jwtVerifyMock.mockResolvedValue({ payload });

    await expect(
      validateGoogleBusinessProfileIdToken({
        idToken: 'secret-token',
        expectedNonce: 'nonce-1',
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({
      code: 'GBP_OIDC_IDENTITY_INVALID',
      message: expect.not.stringContaining('secret-token'),
    });
  });

  it('accepts an absent email as null and a verified email when present', async () => {
    await expect(
      validateGoogleBusinessProfileIdToken({
        idToken: 'signed-token',
        expectedNonce: 'nonce-1',
      }),
    ).resolves.toEqual({ providerUserId: 'google-user-1', email: null, name: null });

    jwtVerifyMock.mockResolvedValue({
      payload: {
        ...validClaims,
        email: 'owner@example.com',
        email_verified: true,
        name: 'Owner',
      },
    });
    await expect(
      validateGoogleBusinessProfileIdToken({
        idToken: 'signed-token',
        expectedNonce: 'nonce-1',
      }),
    ).resolves.toEqual({
      providerUserId: 'google-user-1',
      email: 'owner@example.com',
      name: 'Owner',
    });
  });
});
