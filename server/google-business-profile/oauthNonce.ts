import { createHash, randomBytes } from 'node:crypto';

import { GoogleBusinessProfileError } from './errors';

export type OAuthNonceStore = {
  readonly issue: (input: {
    readonly stateToken: string;
    readonly nonceHash: string;
  }) => Promise<void>;
  readonly consume: (input: {
    readonly stateToken: string;
    readonly nonceHash: string;
  }) => Promise<boolean>;
};

export type BoundOAuthNonce = {
  readonly nonce: string;
  readonly nonceHash: string;
};

export function hashOAuthNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

export async function issueBoundOAuthNonce(
  stateToken: string,
  store: OAuthNonceStore,
): Promise<BoundOAuthNonce> {
  const nonce = randomBytes(32).toString('base64url');
  const nonceHash = hashOAuthNonce(nonce);
  await store.issue({ stateToken, nonceHash });
  return { nonce, nonceHash };
}

export async function consumeBoundOAuthNonce(
  stateToken: string,
  nonce: string,
  store: OAuthNonceStore,
): Promise<void> {
  const consumed = await store.consume({ stateToken, nonceHash: hashOAuthNonce(nonce) });
  if (!consumed) {
    throw new GoogleBusinessProfileError('Google OIDC nonce is invalid or already consumed.', {
      code: 'GBP_OIDC_IDENTITY_INVALID',
      status: 409,
    });
  }
}

export function deriveLegacyBoundOAuthNonce(stateToken: string): string {
  return createHash('sha256').update(`gbp-oidc:${stateToken}`).digest('base64url');
}
