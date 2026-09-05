import { normalizeSupabaseProjectRef } from '../safety';
import { TARGET_PROJECT_REFS, extractDatabaseRole, type RemoteTarget } from './targets';

/**
 * Identity guards for the backup and restore-verify delegations.
 *
 * Backups must run under a dedicated read-only identity (DB_BACKUP_ROLE_URL) that is
 * neither the deploy/migration connection nor the service role. Restore verification may
 * only ever address a scratch project: the production and staging refs are refused
 * outright, whatever the operator claims.
 */

export const BACKUP_ROLE_URL_ENV = 'DB_BACKUP_ROLE_URL';
export const RESTORE_VERIFY_PROJECT_REF_ENV = 'RESTORE_VERIFY_PROJECT_REF';
export const RESTORE_VERIFY_BACKUP_ID_ENV = 'RESTORE_VERIFY_BACKUP_ID';
/** Same name the restore delegate (scripts/db/restore/verify.ts RESTORE_TEMP_DB_URL_ENV) reads for the scratch DB. */
export const RESTORE_VERIFY_DB_URL_ENV = 'RESTORE_VERIFY_DB_URL';
export const BACKUP_BUCKET_ENV = 'DB_BACKUP_BUCKET';

const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type ValueGuardResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string };

/** Bucket names are passed on the delegate command line, so they must be plain identifiers. */
export function validateBackupBucket(env: NodeJS.ProcessEnv): ValueGuardResult {
  const bucket = env[BACKUP_BUCKET_ENV]?.trim();
  if (!bucket) {
    return {
      ok: false,
      message: `${BACKUP_BUCKET_ENV} (object storage bucket for encrypted backups) is required for backup.`,
    };
  }
  if (!BUCKET_NAME_PATTERN.test(bucket) || bucket.includes('..')) {
    return {
      ok: false,
      message: `${BACKUP_BUCKET_ENV} must be a lowercase bucket name (letters, digits, dots, hyphens).`,
    };
  }
  if (/^REPLACE_ME/i.test(bucket)) {
    return { ok: false, message: `${BACKUP_BUCKET_ENV} is an unconfigured placeholder.` };
  }
  return { ok: true, value: bucket };
}

/** Backup identifiers are passed on the delegate command line, so they must be plain tokens. */
export function validateRestoreBackupId(env: NodeJS.ProcessEnv): ValueGuardResult {
  const backupId = env[RESTORE_VERIFY_BACKUP_ID_ENV]?.trim();
  if (!backupId) {
    return {
      ok: false,
      message: `${RESTORE_VERIFY_BACKUP_ID_ENV} (backup identifier to restore) is required for restore-verify.`,
    };
  }
  if (!BACKUP_ID_PATTERN.test(backupId) || backupId.includes('..')) {
    return {
      ok: false,
      message: `${RESTORE_VERIFY_BACKUP_ID_ENV} must be a plain identifier (letters, digits, dot, underscore, hyphen).`,
    };
  }
  if (/^REPLACE_ME/i.test(backupId)) {
    return {
      ok: false,
      message: `${RESTORE_VERIFY_BACKUP_ID_ENV} is an unconfigured placeholder.`,
    };
  }
  return { ok: true, value: backupId };
}

/** Roles that can never be used as a backup identity. */
export const FORBIDDEN_BACKUP_ROLES: readonly string[] = [
  'postgres',
  'service_role',
  'supabase_admin',
  'supabase_auth_admin',
  'supabase_storage_admin',
  'supabase_read_only_user',
  'authenticator',
  'anon',
  'authenticated',
  'dashboard_user',
  'pgbouncer',
];

/** Environment keys that carry deploy or service-role credentials and never reach delegates. */
export const SCRUBBED_DELEGATE_ENV_KEYS: readonly string[] = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_ACCESS_TOKEN',
  'CONFIRM_PRODUCTION',
  'CONFIRM_PRODUCTION_INCLUDE_ALL',
];

export type GuardResult =
  | { readonly ok: true; readonly projectRef: string; readonly role: string | null }
  | { readonly ok: false; readonly message: string };

function projectRefFromConnection(connectionString: string): string | null {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const direct = host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) {
    return direct[1];
  }
  const user = decodeURIComponent(url.username).match(/^[a-z_][a-z0-9_]*\.([a-z0-9]{20})$/i);
  if (user && host.endsWith('.pooler.supabase.com')) {
    return user[1].toLowerCase();
  }
  return null;
}

function passwordOf(connectionString: string): string | null {
  try {
    const password = new URL(connectionString).password;
    return password ? decodeURIComponent(password) : null;
  } catch {
    return null;
  }
}

export function validateBackupIdentity(env: NodeJS.ProcessEnv, target: RemoteTarget): GuardResult {
  const backupUrl = env[BACKUP_ROLE_URL_ENV]?.trim();
  if (!backupUrl) {
    return {
      ok: false,
      message: `${BACKUP_ROLE_URL_ENV} (dedicated read-only backup identity) is required for backup.`,
    };
  }

  const role = extractDatabaseRole(backupUrl);
  if (!role) {
    return { ok: false, message: `${BACKUP_ROLE_URL_ENV} has no recognisable database role.` };
  }
  const normalizedRole = role.toLowerCase();
  if (FORBIDDEN_BACKUP_ROLES.includes(normalizedRole)) {
    return {
      ok: false,
      message: `${BACKUP_ROLE_URL_ENV} uses the ${normalizedRole} role; backups require a dedicated read-only backup role.`,
    };
  }
  if (!/^[a-z][a-z0-9_]*backup[a-z0-9_]*$/.test(normalizedRole)) {
    return {
      ok: false,
      message: `${BACKUP_ROLE_URL_ENV} role "${normalizedRole}" is not a dedicated backup role (name must contain "backup").`,
    };
  }

  const projectRef = projectRefFromConnection(backupUrl);
  const expected = TARGET_PROJECT_REFS[target];
  if (!projectRef) {
    return {
      ok: false,
      message: `${BACKUP_ROLE_URL_ENV} does not address a Supabase database host for ${target}.`,
    };
  }
  if (projectRef !== expected) {
    return {
      ok: false,
      message: `${BACKUP_ROLE_URL_ENV} targets project ${projectRef} but ${target} is ${expected}.`,
    };
  }

  for (const key of ['SUPABASE_DB_URL', 'DATABASE_URL'] as const) {
    const deployUrl = env[key]?.trim();
    if (deployUrl && deployUrl === backupUrl) {
      return {
        ok: false,
        message: `${BACKUP_ROLE_URL_ENV} must not reuse the deploy connection in ${key}.`,
      };
    }
    const deployPassword = deployUrl ? passwordOf(deployUrl) : null;
    const backupPassword = passwordOf(backupUrl);
    if (deployPassword && backupPassword && deployPassword === backupPassword) {
      return {
        ok: false,
        message: `${BACKUP_ROLE_URL_ENV} must not share credentials with the deploy connection in ${key}.`,
      };
    }
  }
  const deployPassword = env.SUPABASE_DB_PASSWORD?.trim();
  if (deployPassword && passwordOf(backupUrl) === deployPassword) {
    return {
      ok: false,
      message: `${BACKUP_ROLE_URL_ENV} must not reuse SUPABASE_DB_PASSWORD.`,
    };
  }

  return { ok: true, projectRef, role: normalizedRole };
}

export function validateRestoreVerifyTarget(env: NodeJS.ProcessEnv): GuardResult {
  const rawRef = env[RESTORE_VERIFY_PROJECT_REF_ENV];
  let projectRef: string;
  try {
    projectRef = normalizeSupabaseProjectRef(rawRef, RESTORE_VERIFY_PROJECT_REF_ENV);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  for (const [name, protectedRef] of Object.entries(TARGET_PROJECT_REFS)) {
    if (projectRef === protectedRef) {
      return {
        ok: false,
        message: `${RESTORE_VERIFY_PROJECT_REF_ENV} names the ${name} project (${protectedRef}); restore verification only runs against a scratch project.`,
      };
    }
  }

  const restoreUrl = env[RESTORE_VERIFY_DB_URL_ENV]?.trim();
  let role: string | null = null;
  if (restoreUrl) {
    const urlRef = projectRefFromConnection(restoreUrl);
    if (urlRef !== projectRef) {
      return {
        ok: false,
        message: `${RESTORE_VERIFY_DB_URL_ENV} does not address ${projectRef}.`,
      };
    }
    role = extractDatabaseRole(restoreUrl);
  }

  return { ok: true, projectRef, role };
}

export function scrubDelegateEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const scrubbed: NodeJS.ProcessEnv = { ...env };
  for (const key of SCRUBBED_DELEGATE_ENV_KEYS) {
    delete scrubbed[key];
  }
  return scrubbed;
}
