import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import { env } from '@/lib/env';

import { GoogleBusinessProfileError } from './errors';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const identityClaimsSchema = z
  .object({
    sub: z.string().min(1),
    nonce: z.string().min(1),
    exp: z.number().int(),
    nbf: z.number().int().optional(),
    email: z.string().email().optional(),
    email_verified: z.boolean().optional(),
    name: z.string().optional(),
    azp: z.string().optional(),
    aud: z.union([z.string(), z.array(z.string()).min(1)]),
  })
  .passthrough();

export type GoogleBusinessProfileIdentity = {
  readonly providerUserId: string;
  readonly email: string | null;
  readonly name: string | null;
};

function invalidIdentity(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError('Google OIDC identity validation failed.', {
    code: 'GBP_OIDC_IDENTITY_INVALID',
    status: 409,
  });
}

export async function validateGoogleBusinessProfileIdToken(params: {
  readonly idToken: string | null | undefined;
  readonly expectedNonce: string;
  readonly clientId?: string;
  readonly key?: JWTVerifyGetKey;
  readonly currentDate?: Date;
}): Promise<GoogleBusinessProfileIdentity> {
  const clientId = params.clientId ?? env.googleBusinessProfile.clientId;
  if (!params.idToken || !clientId) throw invalidIdentity();
  try {
    const result = await jwtVerify(params.idToken, params.key ?? GOOGLE_JWKS, {
      algorithms: ['RS256'],
      issuer: [...GOOGLE_ISSUERS],
      audience: clientId,
      requiredClaims: ['sub', 'exp', 'nonce'],
      currentDate: params.currentDate,
    });
    const claims = identityClaimsSchema.parse(result.payload);
    if (claims.nonce !== params.expectedNonce) throw invalidIdentity();
    const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    if ((audiences.length > 1 || claims.azp) && claims.azp !== clientId) throw invalidIdentity();
    if (claims.email && claims.email_verified !== true) throw invalidIdentity();
    return {
      providerUserId: claims.sub,
      email: claims.email ?? null,
      name: claims.name?.trim() || null,
    };
  } catch (error) {
    if (error instanceof GoogleBusinessProfileError) throw error;
    if (error instanceof Error) throw invalidIdentity();
    throw error;
  }
}

export const fetchGoogleBusinessProfileIdentity = validateGoogleBusinessProfileIdToken;
