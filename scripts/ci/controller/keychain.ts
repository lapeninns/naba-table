import { execFile as nodeExecFile } from 'node:child_process';

/**
 * Reads a secret from the macOS login Keychain via
 * `security find-generic-password -s <service> -a <account> -w`.
 * The secret value is returned to the caller only; it is never logged.
 */
export type ExecFileLike = (
  command: string,
  args: readonly string[],
) => Promise<{ readonly stdout: string; readonly exitCode: number }>;

export const defaultExecFile: ExecFileLike = (command, args) =>
  new Promise((resolve) => {
    nodeExecFile(command, [...args], { encoding: 'utf8', timeout: 10_000 }, (error, stdout) => {
      const exitCode =
        error && typeof (error as { code?: unknown }).code === 'number'
          ? ((error as { code: number }).code ?? 1)
          : error
            ? 1
            : 0;
      resolve({ stdout: typeof stdout === 'string' ? stdout : '', exitCode });
    });
  });

export interface KeychainSecretOptions {
  readonly service: string;
  readonly account: string;
  readonly execFile?: ExecFileLike;
  readonly cacheTtlMs?: number;
  readonly now?: () => number;
}

export type SecretProvider = () => Promise<string>;

export class KeychainSecretError extends Error {
  constructor(service: string, account: string, detail: string) {
    super(
      `Keychain item not readable (service=${service}, account=${account}): ${detail}. ` +
        `Add it with: security add-generic-password -s ${service} -a ${account} -w`,
    );
    this.name = 'KeychainSecretError';
  }
}

export function createKeychainSecretProvider(options: KeychainSecretOptions): SecretProvider {
  const execFile = options.execFile ?? defaultExecFile;
  const now = options.now ?? (() => Date.now());
  const ttl = options.cacheTtlMs ?? 5 * 60 * 1000;
  let cached: { value: string; expiresAt: number } | null = null;
  return async () => {
    if (cached && cached.expiresAt > now()) return cached.value;
    const { stdout, exitCode } = await execFile('security', [
      'find-generic-password',
      '-s',
      options.service,
      '-a',
      options.account,
      '-w',
    ]);
    if (exitCode !== 0) {
      throw new KeychainSecretError(
        options.service,
        options.account,
        `security exited ${exitCode}`,
      );
    }
    const value = stdout.trim();
    if (value.length === 0) {
      throw new KeychainSecretError(options.service, options.account, 'empty secret');
    }
    cached = { value, expiresAt: now() + ttl };
    return value;
  };
}
