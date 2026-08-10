import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { GoogleBusinessProfileError } from './errors';

const PREFIX = 'gbp.1';
const LEGACY_PARTS = 3;

export type CredentialKeyring = {
  readonly activeKeyId: string;
  readonly keys: ReadonlyMap<string, Uint8Array>;
  readonly legacyKey?: Uint8Array;
};

export type CredentialEnvelopeContext = {
  readonly keyring: CredentialKeyring;
  readonly externalProfileId: string;
  readonly column: string;
};

export type DecryptedCredential = {
  readonly plaintext: string;
  readonly keyId: string | null;
  readonly requiresRewrap: boolean;
};

function aad(context: CredentialEnvelopeContext): Buffer {
  return Buffer.from(`gbp:${context.externalProfileId}:${context.column}`, 'utf8');
}

function requireKey(key: Uint8Array | undefined): Buffer {
  if (!key || key.byteLength !== 32) {
    throw new GoogleBusinessProfileError('Google credential encryption key is unavailable.', {
      code: 'GBP_INVALID_ENCRYPTION_KEY',
      status: 500,
    });
  }
  return Buffer.from(key);
}

function malformedCredential(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError('Stored Google credential is malformed.', {
    code: 'GBP_MALFORMED_CREDENTIAL',
    status: 500,
  });
}

export function createCredentialEnvelope(
  plaintext: string,
  context: CredentialEnvelopeContext,
): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(context.keyring.activeKeyId)) {
    throw new GoogleBusinessProfileError('Google credential key identifier is invalid.', {
      code: 'GBP_INVALID_ENCRYPTION_KEY',
      status: 500,
    });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    requireKey(context.keyring.keys.get(context.keyring.activeKeyId)),
    iv,
  );
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    PREFIX,
    context.keyring.activeKeyId,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

export function decryptCredentialEnvelope(
  envelope: string,
  context: CredentialEnvelopeContext,
): DecryptedCredential {
  const parts = envelope.split('.');
  const versioned = parts.length === 6 && parts[0] === 'gbp' && parts[1] === '1';
  const keyId = versioned ? parts[2] : null;
  const encoded = versioned ? parts.slice(3) : parts;
  if (encoded.length !== LEGACY_PARTS) throw malformedCredential();
  const key = requireKey(keyId ? context.keyring.keys.get(keyId) : context.keyring.legacyKey);
  const [ivPart, ciphertextPart, tagPart] = encoded;
  if (!ivPart || !ciphertextPart || !tagPart) throw malformedCredential();
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
    if (versioned) decipher.setAAD(aad(context));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return {
      plaintext,
      keyId,
      requiresRewrap: keyId !== context.keyring.activeKeyId,
    };
  } catch (error) {
    if (error instanceof Error) throw malformedCredential();
    throw error;
  }
}

export type CredentialRewrapStore = {
  readonly compareAndSwap: (
    expectedEnvelope: string,
    replacementEnvelope: string,
  ) => Promise<boolean>;
};

export async function decryptAndRewrapCredential(
  envelope: string,
  context: CredentialEnvelopeContext,
  store: CredentialRewrapStore,
): Promise<DecryptedCredential> {
  const decrypted = decryptCredentialEnvelope(envelope, context);
  if (decrypted.requiresRewrap) {
    await store.compareAndSwap(envelope, createCredentialEnvelope(decrypted.plaintext, context));
  }
  return decrypted;
}

export type CredentialRotationCandidate = {
  readonly id: string;
  readonly envelope: string;
  readonly context: CredentialEnvelopeContext;
  readonly compareAndSwap: CredentialRewrapStore['compareAndSwap'];
};

export async function rotateCredentialBatch(
  candidates: readonly CredentialRotationCandidate[],
  options: { readonly dryRun: boolean; readonly limit?: number },
): Promise<{
  readonly examined: number;
  readonly oldKeyCount: number;
  readonly rewrapped: number;
  readonly conflicts: number;
}> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 100));
  let oldKeyCount = 0;
  let rewrapped = 0;
  let conflicts = 0;
  for (const candidate of candidates.slice(0, limit)) {
    const decrypted = decryptCredentialEnvelope(candidate.envelope, candidate.context);
    if (!decrypted.requiresRewrap) continue;
    oldKeyCount += 1;
    if (options.dryRun) continue;
    const swapped = await candidate.compareAndSwap(
      candidate.envelope,
      createCredentialEnvelope(decrypted.plaintext, candidate.context),
    );
    if (swapped) rewrapped += 1;
    else conflicts += 1;
  }
  return { examined: Math.min(candidates.length, limit), oldKeyCount, rewrapped, conflicts };
}
