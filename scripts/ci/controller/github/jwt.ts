import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';

/** GitHub App JWTs must be RS256 and expire within 10 minutes of issue. */
export const APP_JWT_TTL_SECONDS = 540;
const CLOCK_SKEW_SECONDS = 60;

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export function parsePrivateKey(pem: string): KeyObject {
  const key = createPrivateKey({ key: pem, format: 'pem' });
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error(
      `GitHub App private key must be RSA, received ${key.asymmetricKeyType ?? 'unknown'}`,
    );
  }
  return key;
}

export interface AppJwtInput {
  readonly appId: number;
  readonly privateKey: KeyObject;
  readonly now: Date;
  readonly ttlSeconds?: number;
}

export function createAppJwt(input: AppJwtInput): string {
  const ttl = input.ttlSeconds ?? APP_JWT_TTL_SECONDS;
  if (ttl <= 0 || ttl > 600) throw new Error('GitHub App JWT ttl must be within (0, 600] seconds');
  const issuedAt = Math.floor(input.now.getTime() / 1000) - CLOCK_SKEW_SECONDS;
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iat: issuedAt,
      exp: issuedAt + CLOCK_SKEW_SECONDS + ttl,
      iss: String(input.appId),
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .end()
    .sign(input.privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}
