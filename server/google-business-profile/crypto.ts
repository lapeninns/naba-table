import { env } from '@/lib/env';

import {
  createCredentialEnvelope,
  decryptCredentialEnvelope,
  rotateCredentialBatch,
  type CredentialKeyring,
  type DecryptedCredential,
} from './credentialEnvelope';
import { GoogleBusinessProfileError } from './errors';

const REFRESH_TOKEN_COLUMN = 'refresh_token_encrypted';

function decodeKey(encoded: string): Uint8Array {
  const key = Buffer.from(encoded, 'base64url');
  if (key.byteLength !== 32) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile token encryption key must decode to 32 bytes.',
      { code: 'GBP_INVALID_ENCRYPTION_KEY', status: 500 },
    );
  }
  return key;
}

function getKeyring(): CredentialKeyring {
  const configured = env.googleBusinessProfile.tokenEncryptionKeyring;
  const legacy = env.googleBusinessProfile.tokenEncryptionKey;
  if (!configured && !legacy) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile token encryption key is not configured.',
      { code: 'GBP_NOT_CONFIGURED', status: 503 },
    );
  }
  const keys = new Map(
    Object.entries(configured?.keys ?? {}).map(([keyId, encoded]) => [keyId, decodeKey(encoded)]),
  );
  const legacyKey = legacy ? decodeKey(legacy) : undefined;
  if (legacyKey && !keys.has('legacy')) keys.set('legacy', legacyKey);
  return {
    activeKeyId: configured?.activeKeyId ?? 'legacy-decrypt-only',
    keys,
    legacyKey,
  };
}

export function encryptGoogleBusinessProfileSecret(
  value: string,
  externalProfileId: string,
  column = REFRESH_TOKEN_COLUMN,
): string {
  if (!env.googleBusinessProfile.tokenEncryptionKeyring) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile active encryption key is not configured.',
      { code: 'GBP_NOT_CONFIGURED', status: 503 },
    );
  }
  return createCredentialEnvelope(value, {
    keyring: getKeyring(),
    externalProfileId,
    column,
  });
}

export function decryptGoogleBusinessProfileSecret(
  payload: string,
  externalProfileId: string,
  column = REFRESH_TOKEN_COLUMN,
): string {
  return decryptGoogleBusinessProfileSecretWithMetadata(payload, externalProfileId, column)
    .plaintext;
}

export function decryptGoogleBusinessProfileSecretWithMetadata(
  payload: string,
  externalProfileId: string,
  column = REFRESH_TOKEN_COLUMN,
): DecryptedCredential {
  return decryptCredentialEnvelope(payload, {
    keyring: getKeyring(),
    externalProfileId,
    column,
  });
}

export type GoogleCredentialRotationCandidate = {
  readonly id: string;
  readonly externalProfileId: string;
  readonly envelope: string;
  readonly compareAndSwap: (
    expectedEnvelope: string,
    replacementEnvelope: string,
  ) => Promise<boolean>;
};

export function rotateGoogleBusinessProfileCredentialBatch(
  candidates: readonly GoogleCredentialRotationCandidate[],
  options: { readonly dryRun: boolean; readonly limit?: number },
) {
  const keyring = getKeyring();
  return rotateCredentialBatch(
    candidates.map((candidate) => ({
      id: candidate.id,
      envelope: candidate.envelope,
      compareAndSwap: candidate.compareAndSwap,
      context: {
        keyring,
        externalProfileId: candidate.externalProfileId,
        column: REFRESH_TOKEN_COLUMN,
      },
    })),
    options,
  );
}
