import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import type { GooglePubsubAuthenticationResult, GooglePubsubIngressConfig } from './types';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

type VerifyResult = {
  readonly payload: unknown;
};

export type GooglePubsubJwtVerifier = (
  token: string,
  key: JWTVerifyGetKey,
  options: {
    readonly algorithms: readonly ['RS256'];
    readonly audience: string;
    readonly issuer: typeof GOOGLE_ISSUERS;
    readonly requiredClaims: readonly ['aud', 'exp', 'iss'];
  },
) => Promise<VerifyResult>;

const verifiedClaimsSchema = z
  .object({
    email: z.string().email(),
    email_verified: z.literal(true),
  })
  .passthrough();

const defaultGooglePubsubJwtVerifier: GooglePubsubJwtVerifier = async (token, key, options) => {
  const result = await jwtVerify(token, key, {
    algorithms: [...options.algorithms],
    audience: options.audience,
    issuer: [...options.issuer],
    requiredClaims: [...options.requiredClaims],
  });
  return { payload: result.payload };
};

function bearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function verifyGooglePubsubBearer(
  authorization: string | null,
  config: GooglePubsubIngressConfig,
  verify: GooglePubsubJwtVerifier = defaultGooglePubsubJwtVerifier,
): Promise<GooglePubsubAuthenticationResult> {
  const token = bearerToken(authorization);
  if (!token) return { ok: false, reason: 'missing_token' };

  try {
    const verified = await verify(token, GOOGLE_JWKS, {
      algorithms: ['RS256'],
      audience: config.expectedAudience,
      issuer: GOOGLE_ISSUERS,
      requiredClaims: ['aud', 'exp', 'iss'],
    });
    const claims = verifiedClaimsSchema.safeParse(verified.payload);
    if (!claims.success || claims.data.email !== config.pushServiceAccountEmail) {
      return { ok: false, reason: 'identity_mismatch' };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof errors.JWTClaimValidationFailed) {
      return { ok: false, reason: 'claim_mismatch' };
    }
    return { ok: false, reason: 'invalid_token' };
  }
}
