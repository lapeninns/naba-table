import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  BACKUP_HEADER_LENGTH,
  BACKUP_IV_LENGTH,
  BACKUP_MAGIC,
  BACKUP_TAG_LENGTH,
  BackupEncryptionError,
  BackupEncryptStream,
  decryptBuffer,
  encryptBuffer,
  keyIdFor,
  parseBackupEncryptionKey,
  parseBackupHeader,
} from '../../scripts/db/backup/encrypt';

const KEY = Buffer.alloc(32, 7);

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

describe('backup encryption', () => {
  it('parses a 32-byte key from hex or base64 and rejects other lengths', () => {
    expect(parseBackupEncryptionKey(KEY.toString('hex'))).toEqual(KEY);
    expect(parseBackupEncryptionKey(KEY.toString('base64'))).toEqual(KEY);
    expect(() => parseBackupEncryptionKey('')).toThrow(BackupEncryptionError);
    expect(() => parseBackupEncryptionKey(Buffer.alloc(16).toString('hex'))).toThrow(/32 bytes/);
  });

  it('writes the documented header: magic, version, algorithm, iv length, iv, key id', () => {
    const iv = Buffer.alloc(BACKUP_IV_LENGTH, 1);
    const encrypted = encryptBuffer(KEY, Buffer.from('hello'), iv);
    expect(encrypted.subarray(0, 4)).toEqual(BACKUP_MAGIC);
    expect(encrypted[4]).toBe(1);
    expect(encrypted[5]).toBe(1);
    expect(encrypted[6]).toBe(BACKUP_IV_LENGTH);
    expect(encrypted.subarray(7, 7 + BACKUP_IV_LENGTH)).toEqual(iv);
    expect(encrypted.subarray(7 + BACKUP_IV_LENGTH, BACKUP_HEADER_LENGTH)).toEqual(keyIdFor(KEY));
    expect(encrypted.length).toBe(BACKUP_HEADER_LENGTH + 5 + BACKUP_TAG_LENGTH);
    const parsed = parseBackupHeader(encrypted);
    expect(parsed.iv).toEqual(iv);
    expect(parsed.keyId.toString('hex')).toBe(keyIdFor(KEY).toString('hex'));
  });

  it('round-trips a buffer and the ciphertext never contains the plaintext', () => {
    const plaintext = Buffer.from('PGDMP synthetic dump payload that must stay confidential');
    const encrypted = encryptBuffer(KEY, plaintext);
    expect(encrypted.includes(plaintext.subarray(0, 12))).toBe(false);
    expect(decryptBuffer(KEY, encrypted)).toEqual(plaintext);
  });

  it('fails closed on tampering, truncation and a different key', () => {
    const encrypted = encryptBuffer(KEY, Buffer.from('payload'));
    const tampered = Buffer.from(encrypted);
    tampered[BACKUP_HEADER_LENGTH] = (tampered[BACKUP_HEADER_LENGTH] ?? 0) ^ 0xff;
    expect(() => decryptBuffer(KEY, tampered)).toThrow(/authentication failed/);
    const swappedIv = Buffer.from(encrypted);
    swappedIv[7] = (swappedIv[7] ?? 0) ^ 0x01;
    expect(() => decryptBuffer(KEY, swappedIv)).toThrow(/authentication failed/);
    expect(() => decryptBuffer(KEY, encrypted.subarray(0, BACKUP_HEADER_LENGTH + 2))).toThrow(
      /truncated/,
    );
    expect(() => decryptBuffer(randomBytes(32), encrypted)).toThrow(/different key/);
    expect(() => parseBackupHeader(Buffer.from('nope'))).toThrow(/shorter than the header/);
  });

  it('streams pg_dump output through the encryptor and decrypts to the same bytes', async () => {
    const chunks = [Buffer.from('PGDMP'), randomBytes(10_000), randomBytes(3)];
    const encryptor = new BackupEncryptStream(KEY);
    const encrypted = await collect(Readable.from(chunks).pipe(encryptor));
    expect(encrypted.subarray(0, BACKUP_HEADER_LENGTH)).toEqual(encryptor.header);
    expect(decryptBuffer(KEY, encrypted)).toEqual(Buffer.concat(chunks));
  });

  it('still emits a header and tag for an empty stream', async () => {
    const encrypted = await collect(Readable.from([]).pipe(new BackupEncryptStream(KEY)));
    expect(encrypted.length).toBe(BACKUP_HEADER_LENGTH + BACKUP_TAG_LENGTH);
    expect(decryptBuffer(KEY, encrypted)).toEqual(Buffer.alloc(0));
  });
});
