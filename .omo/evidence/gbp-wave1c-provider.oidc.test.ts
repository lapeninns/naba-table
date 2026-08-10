import { randomBytes } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { googleBusinessProfile: { clientId: 'client-1' } },
}));

import { validateGoogleBusinessProfileIdToken } from '@/server/google-business-profile/clientIdentity';

describe('local jose OIDC driver', () => {
  it('accepts only RS256 Google identity claims bound to audience, azp, nonce, and time', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const now = new Date('2026-08-09T10:00:00.000Z');
    const seconds = Math.floor(now.getTime() / 1000);
    const sign = (input: {
      issuer?: string;
      audience?: string | string[];
      nonce?: string;
      azp?: string;
      subject?: string;
      expiresAt?: number;
      notBefore?: number;
      emailVerified?: boolean;
    }) =>
      new SignJWT({
        nonce: input.nonce ?? 'nonce-1',
        azp: input.azp,
        email: 'owner@example.com',
        email_verified: input.emailVerified ?? true,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer(input.issuer ?? 'https://accounts.google.com')
        .setAudience(input.audience ?? 'client-1')
        .setSubject(input.subject ?? 'google-user-1')
        .setNotBefore(input.notBefore ?? seconds - 1)
        .setExpirationTime(input.expiresAt ?? seconds + 60)
        .sign(privateKey);
    const validate = (idToken: string) =>
      validateGoogleBusinessProfileIdToken({
        idToken,
        expectedNonce: 'nonce-1',
        clientId: 'client-1',
        key: async () => publicKey,
        currentDate: now,
      });

    await expect(validate(await sign({}))).resolves.toMatchObject({
      providerUserId: 'google-user-1',
      email: 'owner@example.com',
    });

    for (const token of await Promise.all([
      sign({ issuer: 'https://issuer.invalid' }),
      sign({ audience: 'other-client' }),
      sign({ audience: ['client-1', 'other-client'], azp: 'other-client' }),
      sign({ nonce: 'wrong' }),
      sign({ expiresAt: seconds - 1 }),
      sign({ notBefore: seconds + 60 }),
      sign({ subject: '' }),
      sign({ emailVerified: false }),
    ])) {
      await expect(validate(token)).rejects.toMatchObject({
        code: 'GBP_OIDC_IDENTITY_INVALID',
      });
    }

    const hsToken = await new SignJWT({ nonce: 'nonce-1', sub: 'google-user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('client-1')
      .setExpirationTime(seconds + 60)
      .sign(randomBytes(32));
    await expect(validate(hsToken)).rejects.toMatchObject({
      code: 'GBP_OIDC_IDENTITY_INVALID',
    });
  });
});
