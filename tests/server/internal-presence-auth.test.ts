import {
  createHash,
  generateKeyPairSync,
  sign as signBytes,
} from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  InternalServiceAuthError,
  verifyInternalServiceRequest,
} from '@/server/internal-service-auth';

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function tokenFor(input: {
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
  method?: string;
  path?: string;
  issuedAt?: number;
  expiresAt?: number;
  audience?: string;
}) {
  const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
  const header = base64url(
    JSON.stringify({ alg: 'EdDSA', kid: 'presence-test', typ: 'JWT' }),
  );
  const payload = base64url(
    JSON.stringify({
      iss: 'nabapresence',
      aud: input.audience ?? 'nabatable-internal',
      sub: 'nabapresence',
      jti: '4f2f72d6-e61b-4f11-922e-70529282dcb0',
      iat: issuedAt,
      exp: input.expiresAt ?? issuedAt + 60,
      method: input.method ?? 'GET',
      path:
        input.path ??
        '/api/internal/presence/v1/restaurants/restaurant-1/projection',
      bodySha256: createHash('sha256').update('').digest('hex'),
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = signBytes(
    null,
    Buffer.from(signingInput),
    input.privateKey,
  ).toString('base64url');
  return `${signingInput}.${signature}`;
}

describe('NabaPresence internal service authentication', () => {
  it('accepts a short-lived EdDSA token bound to method, path, and body', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const path =
      '/api/internal/presence/v1/restaurants/restaurant-1/projection';
    const request = new Request(`https://nabatable.test${path}`, {
      headers: {
        authorization: `Bearer ${tokenFor({ privateKey, path })}`,
      },
    });

    await expect(
      verifyInternalServiceRequest(request, {
        publicKeyPem: publicKey.export({
          type: 'spki',
          format: 'pem',
        }) as string,
        keyId: 'presence-test',
        issuer: 'nabapresence',
        audience: 'nabatable-internal',
        now: () => new Date(),
      }),
    ).resolves.toMatchObject({
      issuer: 'nabapresence',
      subject: 'nabapresence',
    });
  });

  it('rejects tokens replayed against a different route', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const request = new Request(
      'https://nabatable.test/api/internal/presence/v1/restaurants/restaurant-2/projection',
      {
        headers: {
          authorization: `Bearer ${tokenFor({ privateKey })}`,
        },
      },
    );

    await expect(
      verifyInternalServiceRequest(request, {
        publicKeyPem: publicKey.export({
          type: 'spki',
          format: 'pem',
        }) as string,
        keyId: 'presence-test',
        issuer: 'nabapresence',
        audience: 'nabatable-internal',
        now: () => new Date(),
      }),
    ).rejects.toBeInstanceOf(InternalServiceAuthError);
  });

  it('rejects expired and wrong-audience tokens', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
    const nowSeconds = Math.floor(Date.now() / 1000);

    for (const token of [
      tokenFor({
        privateKey,
        issuedAt: nowSeconds - 120,
        expiresAt: nowSeconds - 60,
      }),
      tokenFor({ privateKey, audience: 'wrong-audience' }),
    ]) {
      const request = new Request(
        'https://nabatable.test/api/internal/presence/v1/restaurants/restaurant-1/projection',
        { headers: { authorization: `Bearer ${token}` } },
      );
      await expect(
        verifyInternalServiceRequest(request, {
          publicKeyPem,
          keyId: 'presence-test',
          issuer: 'nabapresence',
          audience: 'nabatable-internal',
          now: () => new Date(),
        }),
      ).rejects.toBeInstanceOf(InternalServiceAuthError);
    }
  });
});
