import { createCipheriv, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleConfig = vi.hoisted<{
  tokenEncryptionKey: string | null;
  tokenEncryptionKeyring: {
    activeKeyId: string;
    keys: Readonly<Record<string, string>>;
  } | null;
}>(() => ({ tokenEncryptionKey: null, tokenEncryptionKeyring: null }));

vi.mock('@/lib/env', () => ({
  env: { googleBusinessProfile: googleConfig },
}));

import { createCredentialEnvelope } from '@/server/google-business-profile/credentialEnvelope';
import {
  decryptGoogleBusinessProfileSecret,
  decryptGoogleBusinessProfileSecretWithMetadata,
  encryptGoogleBusinessProfileSecret,
  rotateGoogleBusinessProfileCredentialBatch,
} from '@/server/google-business-profile/crypto';

function encodeLegacy(value: string, key: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, ciphertext, cipher.getAuthTag()].map((part) => part.toString('base64url')).join('.');
}

describe('Google credential crypto runtime', () => {
  beforeEach(() => {
    googleConfig.tokenEncryptionKey = null;
    googleConfig.tokenEncryptionKeyring = null;
  });

  it('encrypts with the active key when only keyring configuration exists', () => {
    const active = randomBytes(32);
    googleConfig.tokenEncryptionKeyring = {
      activeKeyId: 'active-2',
      keys: { 'active-2': active.toString('base64url') },
    };

    const envelope = encryptGoogleBusinessProfileSecret('refresh-token', 'profile-1');

    expect(envelope.startsWith('gbp.1.active-2.')).toBe(true);
    expect(decryptGoogleBusinessProfileSecret(envelope, 'profile-1')).toBe('refresh-token');
  });

  it('decrypts an old versioned key and reports that it requires CAS rewrap', () => {
    const active = randomBytes(32);
    const old = randomBytes(32);
    googleConfig.tokenEncryptionKeyring = {
      activeKeyId: 'active',
      keys: { active: active.toString('base64url'), old: old.toString('base64url') },
    };
    const envelope = createCredentialEnvelope('refresh-token', {
      keyring: { activeKeyId: 'old', keys: new Map([['old', old]]) },
      externalProfileId: 'profile-1',
      column: 'refresh_token_encrypted',
    });

    expect(decryptGoogleBusinessProfileSecretWithMetadata(envelope, 'profile-1')).toMatchObject({
      plaintext: 'refresh-token',
      keyId: 'old',
      requiresRewrap: true,
    });
  });

  it('uses the legacy single key only to decrypt an unversioned credential', () => {
    const legacy = randomBytes(32);
    const active = randomBytes(32);
    googleConfig.tokenEncryptionKey = legacy.toString('base64url');
    googleConfig.tokenEncryptionKeyring = {
      activeKeyId: 'active',
      keys: { active: active.toString('base64url') },
    };

    expect(
      decryptGoogleBusinessProfileSecret(encodeLegacy('refresh-token', legacy), 'profile-1'),
    ).toBe('refresh-token');
    expect(encryptGoogleBusinessProfileSecret('new-token', 'profile-1')).toMatch(
      /^gbp\.1\.active\./,
    );
  });

  it('decrypts the prior versioned legacy key as a fallback and marks it for rewrap', () => {
    const legacy = randomBytes(32);
    const active = randomBytes(32);
    googleConfig.tokenEncryptionKey = legacy.toString('base64url');
    googleConfig.tokenEncryptionKeyring = {
      activeKeyId: 'active',
      keys: { active: active.toString('base64url') },
    };
    const envelope = createCredentialEnvelope('refresh-token', {
      keyring: { activeKeyId: 'legacy', keys: new Map([['legacy', legacy]]) },
      externalProfileId: 'profile-1',
      column: 'refresh_token_encrypted',
    });

    expect(decryptGoogleBusinessProfileSecretWithMetadata(envelope, 'profile-1')).toMatchObject({
      plaintext: 'refresh-token',
      keyId: 'legacy',
      requiresRewrap: true,
    });
  });

  it('reports an old-key census without mutating during the required dry run', async () => {
    const active = randomBytes(32);
    const old = randomBytes(32);
    googleConfig.tokenEncryptionKeyring = {
      activeKeyId: 'active',
      keys: { active: active.toString('base64url'), old: old.toString('base64url') },
    };
    const envelope = createCredentialEnvelope('refresh-token', {
      keyring: { activeKeyId: 'old', keys: new Map([['old', old]]) },
      externalProfileId: 'profile-1',
      column: 'refresh_token_encrypted',
    });
    const compareAndSwap = vi.fn();

    await expect(
      rotateGoogleBusinessProfileCredentialBatch(
        [{ id: 'credential-1', externalProfileId: 'profile-1', envelope, compareAndSwap }],
        { dryRun: true },
      ),
    ).resolves.toEqual({ examined: 1, oldKeyCount: 1, rewrapped: 0, conflicts: 0 });
    expect(compareAndSwap).not.toHaveBeenCalled();
  });
});
