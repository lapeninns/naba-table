import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

/**
 * Backup encryption: AES-256-GCM, streaming.
 *
 * File layout (all big-endian, fixed sizes):
 *   magic       4 bytes  "NBK1"
 *   version     1 byte   0x01
 *   algorithm   1 byte   0x01 (aes-256-gcm)
 *   ivLength    1 byte   12
 *   iv         12 bytes
 *   keyId       8 bytes  first 8 bytes of sha256(key) — identifies the key, reveals nothing
 *   ciphertext  N bytes
 *   tag        16 bytes  GCM auth tag (trailer, written after the ciphertext)
 *
 * The header is authenticated as GCM additional data so a swapped IV/keyId is detected.
 */

export const BACKUP_MAGIC = Buffer.from('NBK1', 'ascii');
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_ALGORITHM_ID = 1;
export const BACKUP_IV_LENGTH = 12;
export const BACKUP_KEY_ID_LENGTH = 8;
export const BACKUP_TAG_LENGTH = 16;
export const BACKUP_HEADER_LENGTH =
  BACKUP_MAGIC.length + 3 + BACKUP_IV_LENGTH + BACKUP_KEY_ID_LENGTH;
export const BACKUP_ENCRYPTION_KEY_ENV = 'BACKUP_ENCRYPTION_KEY';

export class BackupEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupEncryptionError';
  }
}

export function keyIdFor(key: Buffer): Buffer {
  return createHash('sha256').update(key).digest().subarray(0, BACKUP_KEY_ID_LENGTH);
}

/** Parse a 32-byte key from base64 or hex. Never logs the value. */
export function parseBackupEncryptionKey(raw: string | undefined): Buffer {
  const value = raw?.trim() ?? '';
  if (!value) {
    throw new BackupEncryptionError(`${BACKUP_ENCRYPTION_KEY_ENV} is not set.`);
  }
  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    key = Buffer.from(value, 'base64');
  }
  if (key.length !== 32) {
    throw new BackupEncryptionError(
      `${BACKUP_ENCRYPTION_KEY_ENV} must decode to exactly 32 bytes (hex or base64).`,
    );
  }
  return key;
}

export function buildBackupHeader(key: Buffer, iv: Buffer): Buffer {
  if (iv.length !== BACKUP_IV_LENGTH) {
    throw new BackupEncryptionError(`IV must be ${BACKUP_IV_LENGTH} bytes.`);
  }
  const meta = Buffer.from([BACKUP_FORMAT_VERSION, BACKUP_ALGORITHM_ID, BACKUP_IV_LENGTH]);
  return Buffer.concat([BACKUP_MAGIC, meta, iv, keyIdFor(key)]);
}

export type ParsedBackupHeader = {
  readonly version: number;
  readonly algorithm: number;
  readonly iv: Buffer;
  readonly keyId: Buffer;
  readonly header: Buffer;
};

export function parseBackupHeader(bytes: Buffer): ParsedBackupHeader {
  if (bytes.length < BACKUP_HEADER_LENGTH) {
    throw new BackupEncryptionError('Backup file is shorter than the header.');
  }
  if (!bytes.subarray(0, 4).equals(BACKUP_MAGIC)) {
    throw new BackupEncryptionError('Backup file magic mismatch.');
  }
  const version = bytes[4];
  const algorithm = bytes[5];
  const ivLength = bytes[6];
  if (version !== BACKUP_FORMAT_VERSION) {
    throw new BackupEncryptionError(`Unsupported backup format version ${String(version)}.`);
  }
  if (algorithm !== BACKUP_ALGORITHM_ID) {
    throw new BackupEncryptionError(`Unsupported backup algorithm id ${String(algorithm)}.`);
  }
  if (ivLength !== BACKUP_IV_LENGTH) {
    throw new BackupEncryptionError(`Unsupported IV length ${String(ivLength)}.`);
  }
  const iv = Buffer.from(bytes.subarray(7, 7 + BACKUP_IV_LENGTH));
  const keyId = Buffer.from(bytes.subarray(7 + BACKUP_IV_LENGTH, BACKUP_HEADER_LENGTH));
  return {
    version,
    algorithm,
    iv,
    keyId,
    header: Buffer.from(bytes.subarray(0, BACKUP_HEADER_LENGTH)),
  };
}

/**
 * Transform stream: plaintext in, `header + ciphertext + tag` out. The plaintext never
 * touches disk; callers pipe pg_dump stdout straight through this.
 */
export class BackupEncryptStream extends Transform {
  private readonly cipher;
  private headerWritten = false;
  readonly header: Buffer;

  constructor(key: Buffer, iv: Buffer = randomBytes(BACKUP_IV_LENGTH)) {
    super();
    if (key.length !== 32) throw new BackupEncryptionError('Key must be 32 bytes.');
    this.header = buildBackupHeader(key, iv);
    this.cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: BACKUP_TAG_LENGTH });
    this.cipher.setAAD(this.header);
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (!this.headerWritten) {
      this.headerWritten = true;
      this.push(this.header);
    }
    this.push(this.cipher.update(chunk));
    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (!this.headerWritten) {
      this.headerWritten = true;
      this.push(this.header);
    }
    this.push(this.cipher.final());
    this.push(this.cipher.getAuthTag());
    callback();
  }
}

export function encryptBuffer(key: Buffer, plaintext: Buffer, iv?: Buffer): Buffer {
  const header = buildBackupHeader(key, iv ?? randomBytes(BACKUP_IV_LENGTH));
  const parsed = parseBackupHeader(header);
  const cipher = createCipheriv('aes-256-gcm', key, parsed.iv, {
    authTagLength: BACKUP_TAG_LENGTH,
  });
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([header, body, cipher.getAuthTag()]);
}

/** Decrypt an in-memory encrypted backup. Throws on any tampering. */
export function decryptBuffer(key: Buffer, encrypted: Buffer): Buffer {
  const parsed = parseBackupHeader(encrypted);
  if (!parsed.keyId.equals(keyIdFor(key))) {
    throw new BackupEncryptionError('Backup was encrypted with a different key.');
  }
  if (encrypted.length < BACKUP_HEADER_LENGTH + BACKUP_TAG_LENGTH) {
    throw new BackupEncryptionError('Backup file is truncated (missing auth tag).');
  }
  const tag = encrypted.subarray(encrypted.length - BACKUP_TAG_LENGTH);
  const body = encrypted.subarray(BACKUP_HEADER_LENGTH, encrypted.length - BACKUP_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, parsed.iv, {
    authTagLength: BACKUP_TAG_LENGTH,
  });
  decipher.setAAD(parsed.header);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new BackupEncryptionError('Backup authentication failed (corrupt or tampered).');
  }
}
