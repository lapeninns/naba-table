import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Shared AES-256-GCM token framing for the stateless "secret" tokens
 * (`bk1.` booking access, `unsub1.` unsubscribe).
 *
 * Format: `<prefix>.<iv b64url 12B>.<ciphertext b64url>.<tag b64url 16B>`.
 * The key is `sha256("<keyLabel>:<secret>")` and the AAD is the prefix, so a
 * token minted for one purpose never opens under another purpose's key, even
 * though every purpose derives from the same deployment secret.
 */

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const B64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type AeadTokenParams = {
  /** Token prefix, also used as AAD (for example `bk1`). */
  prefix: string;
  /** Purpose label mixed into the key derivation. */
  keyLabel: string;
  secret: string;
};

export type AeadTokenOpenFailure = 'invalid_format' | 'invalid_prefix' | 'invalid_signature';

export type AeadTokenOpenResult =
  | { ok: true; plaintext: string }
  | { ok: false; reason: AeadTokenOpenFailure };

function deriveKey(keyLabel: string, secret: string): Buffer {
  return createHash('sha256').update(`${keyLabel}:${secret}`).digest();
}

function decodeB64Url(value: string): Buffer | null {
  if (!B64URL_PATTERN.test(value)) {
    return null;
  }
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

export function sealAeadToken(params: AeadTokenParams & { plaintext: string }): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(params.keyLabel, params.secret), iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  cipher.setAAD(Buffer.from(params.prefix, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(params.plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    params.prefix,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function openAeadToken(token: string, params: AeadTokenParams): AeadTokenOpenResult {
  if (typeof token !== 'string') {
    return { ok: false, reason: 'invalid_format' };
  }
  const parts = token.split('.');
  if (parts.length !== 4) {
    return { ok: false, reason: 'invalid_format' };
  }

  const [prefix, ivB64, ciphertextB64, tagB64] = parts;
  if (prefix !== params.prefix) {
    return { ok: false, reason: 'invalid_prefix' };
  }

  const iv = decodeB64Url(ivB64);
  const ciphertext = decodeB64Url(ciphertextB64);
  const tag = decodeB64Url(tagB64);
  if (
    !iv ||
    !ciphertext ||
    !tag ||
    iv.length !== IV_LENGTH_BYTES ||
    tag.length !== AUTH_TAG_LENGTH_BYTES
  ) {
    return { ok: false, reason: 'invalid_signature' };
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey(params.keyLabel, params.secret),
      iv,
      { authTagLength: AUTH_TAG_LENGTH_BYTES },
    );
    decipher.setAAD(Buffer.from(params.prefix, 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    );
    return { ok: true, plaintext };
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }
}
