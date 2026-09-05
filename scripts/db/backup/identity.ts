/**
 * Backup identity guard.
 *
 * The independent backup must run under a dedicated, read-only Postgres role. This
 * module refuses anything that looks like a privileged or deployment identity, and
 * returns a redacted descriptor (no password, no full URL) for logs and manifests.
 */

export const DEFAULT_IDENTITY_ENV = 'DB_BACKUP_ROLE_URL';

const FORBIDDEN_USER_PATTERNS: readonly RegExp[] = [
  /^postgres$/i,
  /^postgres\./i, // pooler form: postgres.<project-ref>
  /^service_role$/i,
  /^supabase_admin$/i,
  /^supabase_auth_admin$/i,
  /^supabase_storage_admin$/i,
  /^authenticator$/i,
  /^dashboard_user$/i,
  /^pgbouncer$/i,
  /admin/i,
  /service/i,
];

/** Env vars that carry deployment/migration credentials; a backup URL must never equal them. */
export const DEPLOY_CREDENTIAL_ENV_KEYS: readonly string[] = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_DB_PASSWORD',
  'PROD_DB_URL',
  'PRODUCTION_DATABASE_URL',
  'STAGING_DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export type BackupIdentity = {
  readonly user: string;
  readonly host: string;
  readonly database: string;
  readonly projectRef: string | null;
};

export class BackupIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupIdentityError';
  }
}

function extractProjectRef(url: URL, user: string): string | null {
  const hostParts = url.hostname.toLowerCase().split('.');
  if (
    hostParts.length === 4 &&
    hostParts[0] === 'db' &&
    hostParts[2] === 'supabase' &&
    hostParts[3] === 'co'
  ) {
    return hostParts[1] ?? null;
  }
  const poolerMatch = user.match(/\.([a-z0-9]{20})$/i);
  if (poolerMatch && url.hostname.toLowerCase().endsWith('.pooler.supabase.com')) {
    return poolerMatch[1] ?? null;
  }
  return null;
}

function normalizeSecret(value: string | undefined): string {
  return value?.trim() ?? '';
}

export type AssertBackupIdentityOptions = {
  readonly identityEnv?: string;
  readonly expectedProjectRef?: string;
};

/**
 * Validate the backup role URL found in `env[identityEnv]`. Throws BackupIdentityError
 * on any doubt; never includes the URL or password in the error message.
 */
export function assertBackupIdentity(
  env: NodeJS.ProcessEnv,
  options: AssertBackupIdentityOptions = {},
): BackupIdentity {
  const identityEnv = options.identityEnv ?? DEFAULT_IDENTITY_ENV;
  if (!/^[A-Z][A-Z0-9_]*$/.test(identityEnv)) {
    throw new BackupIdentityError('identity env name must be an UPPER_SNAKE_CASE variable name.');
  }
  const raw = normalizeSecret(env[identityEnv]);
  if (!raw) {
    throw new BackupIdentityError(
      `${identityEnv} is not set; refusing to run without a dedicated backup identity.`,
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BackupIdentityError(`${identityEnv} is not a valid connection URL.`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new BackupIdentityError(`${identityEnv} must be a postgresql:// URL.`);
  }
  const user = decodeURIComponent(url.username);
  if (!user) {
    throw new BackupIdentityError(
      `${identityEnv} has no user; a dedicated backup role is required.`,
    );
  }
  if (!url.password) {
    throw new BackupIdentityError(
      `${identityEnv} has no password; refusing ambient authentication.`,
    );
  }
  for (const pattern of FORBIDDEN_USER_PATTERNS) {
    if (pattern.test(user)) {
      throw new BackupIdentityError(
        `${identityEnv} user looks like a privileged or deployment identity; use the dedicated read-only backup role.`,
      );
    }
  }
  if (!/backup/i.test(user)) {
    throw new BackupIdentityError(
      `${identityEnv} user must be the dedicated backup role (name must contain "backup").`,
    );
  }

  for (const key of DEPLOY_CREDENTIAL_ENV_KEYS) {
    const deployValue = normalizeSecret(env[key]);
    if (!deployValue) continue;
    if (deployValue === raw) {
      throw new BackupIdentityError(
        `${identityEnv} matches deployment credential ${key}; refusing.`,
      );
    }
    if (url.password && deployValue.includes(url.password)) {
      throw new BackupIdentityError(
        `${identityEnv} shares a secret with deployment credential ${key}; refusing.`,
      );
    }
    try {
      const deployUrl = new URL(deployValue);
      if (deployUrl.username && decodeURIComponent(deployUrl.username) === user) {
        throw new BackupIdentityError(
          `${identityEnv} reuses the user of deployment credential ${key}; refusing.`,
        );
      }
    } catch (error) {
      if (error instanceof BackupIdentityError) throw error;
      // Not a URL (e.g. a bare password or key); already compared above.
    }
  }

  const projectRef = extractProjectRef(url, user);
  if (options.expectedProjectRef && projectRef !== options.expectedProjectRef.toLowerCase()) {
    throw new BackupIdentityError(
      `${identityEnv} does not target the expected Supabase project ref (${options.expectedProjectRef}).`,
    );
  }

  return {
    user,
    host: url.hostname.toLowerCase(),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    projectRef,
  };
}
