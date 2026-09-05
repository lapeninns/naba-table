import { isPlaceholder, type KeychainConfig } from '../config';
import type { CommandRunner } from '../runner';
import type { SigV4Credentials } from './sigv4';

/**
 * R2 credentials are read by the controller/executor on the Mac only, from the
 * environment or the service account's login Keychain (item names come from
 * infra/local-ci/operating.json). They are never written to the job dir, never
 * passed to Lima or docker, and never logged.
 */

export const R2_ENV_ACCESS_KEY_ID = 'NABATABLE_CI_R2_ACCESS_KEY_ID';
export const R2_ENV_SECRET_ACCESS_KEY = 'NABATABLE_CI_R2_SECRET_ACCESS_KEY';

export type CredentialLookup =
  | {
      readonly ok: true;
      readonly credentials: SigV4Credentials;
      readonly source: 'env' | 'keychain';
    }
  | { readonly ok: false; readonly reason: string };

export interface CredentialDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly keychain: KeychainConfig;
  /** Runner used for `security find-generic-password`; omit to disable Keychain lookup. */
  readonly runner?: CommandRunner;
  readonly pathEnv?: string;
}

function valid(value: string | undefined): value is string {
  return value !== undefined && !isPlaceholder(value) && /^[A-Za-z0-9+/=_.-]{16,}$/u.test(value);
}

async function fromKeychain(deps: CredentialDeps, service: string): Promise<string | undefined> {
  if (!deps.runner || service === '') return undefined;
  const result = await deps.runner.run({
    command: 'security',
    args: ['find-generic-password', '-s', service, '-a', deps.keychain.account, '-w'],
    env: { PATH: deps.pathEnv ?? '/usr/bin:/bin' },
    timeoutMs: 15_000,
    maxOutputBytes: 4096,
    purpose: `keychain lookup ${service}`,
  });
  if (result.exitCode !== 0) return undefined;
  return result.stdout.trim();
}

export async function loadR2Credentials(deps: CredentialDeps): Promise<CredentialLookup> {
  const envKey = deps.env[R2_ENV_ACCESS_KEY_ID];
  const envSecret = deps.env[R2_ENV_SECRET_ACCESS_KEY];
  if (valid(envKey) && valid(envSecret)) {
    return {
      ok: true,
      credentials: { accessKeyId: envKey, secretAccessKey: envSecret },
      source: 'env',
    };
  }
  if (envKey !== undefined || envSecret !== undefined) {
    return { ok: false, reason: 'R2 credentials in env are placeholders or malformed' };
  }
  const keychainKey = await fromKeychain(deps, deps.keychain.r2AccessKeyIdService);
  const keychainSecret = await fromKeychain(deps, deps.keychain.r2SecretAccessKeyService);
  if (valid(keychainKey) && valid(keychainSecret)) {
    return {
      ok: true,
      credentials: { accessKeyId: keychainKey, secretAccessKey: keychainSecret },
      source: 'keychain',
    };
  }
  return {
    ok: false,
    reason: `R2 credentials unconfigured: set ${R2_ENV_ACCESS_KEY_ID}/${R2_ENV_SECRET_ACCESS_KEY} or Keychain items ${deps.keychain.r2AccessKeyIdService || '<unset>'} and ${deps.keychain.r2SecretAccessKeyService || '<unset>'} for account ${deps.keychain.account}`,
  };
}
