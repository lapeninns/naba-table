import { assertExactSupabaseApiProjectRef, assertExactSupabaseProjectRef } from '../safety';
import {
  LINKED_PROJECT_REF_RELATIVE_PATH,
  expectedProjectRef,
  readLinkedProjectRef,
  type RemoteTarget,
} from './targets';

/**
 * DB-scoped environment guard for scripts/db/safe-run.ts.
 *
 * This replaces the former `pnpm validate:env` child step. That step parsed the whole web-app
 * schema (NEXT_PUBLIC_SUPABASE_URL, anon key, service-role key, ...), so it could never pass on a
 * hosted runner that carries only database credentials, and it refused DB_TARGET_ENV=production
 * outright unless APP_ENV=production or ALLOW_PROD_DB_WIPE=true. Production writes are gated by
 * the explicit CONFIRM_PRODUCTION=true refusal in safe-run.ts instead; this guard proves, in
 * process and before any child, that every database-related variable that IS present is real
 * (no placeholders) and bound to the named target, and that the linked Supabase project matches
 * the target when the workflow talks to the linked project.
 *
 * Nothing here prints a variable value: connection strings and tokens stay out of stdout/stderr.
 */

/** Keys that may hold a database credential or address and are refused when they hold a placeholder. */
export const DB_SCOPED_ENV_KEYS: readonly string[] = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_PROJECT_REF',
  'DB_BACKUP_ROLE_URL',
  'DB_BACKUP_BUCKET',
  'RESTORE_VERIFY_PROJECT_REF',
  'RESTORE_VERIFY_BACKUP_ID',
  'RESTORE_VERIFY_DB_URL',
];

/** Connection strings that must address the target project when present. */
export const DB_CONNECTION_ENV_KEYS: readonly string[] = ['SUPABASE_DB_URL', 'DATABASE_URL'];

/** API URLs that must address the target project when present. */
export const DB_API_URL_ENV_KEYS: readonly string[] = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [/^REPLACE_ME/i, /^CHANGE_?ME/i, /^<[^>]*>$/];

export type DbEnvGuardInput = {
  readonly env: NodeJS.ProcessEnv;
  readonly target: RemoteTarget;
  /**
   * Root whose supabase/.temp/project-ref must name the target. Pass it for workflows that run the
   * Supabase CLI against the linked project; omit it for delegates that prove their own identity.
   */
  readonly linkedSourceRoot?: string;
};

export type DbEnvGuardResult =
  | { readonly ok: true; readonly guards: readonly string[] }
  | { readonly ok: false; readonly message: string };

export function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One-line description of what the guard proves, for dry-run output and help text. */
export function describeDbEnvironmentGuard(requiresLinkedProject: boolean): string {
  const scope = [
    'DB_TARGET_ENV',
    'no placeholder credentials',
    'connection and API URLs bound to the target',
    ...(requiresLinkedProject ? [`${LINKED_PROJECT_REF_RELATIVE_PATH} names the target`] : []),
  ];
  return `db-scoped environment guard (${scope.join('; ')}; no web-app env required)`;
}

export function validateDbEnvironment(input: DbEnvGuardInput): DbEnvGuardResult {
  const { env, target } = input;
  const expected = expectedProjectRef(target);
  const guards: string[] = [];

  if (env.DB_TARGET_ENV !== target) {
    return {
      ok: false,
      message: `DB_TARGET_ENV must be exactly ${target} for this run.`,
    };
  }

  for (const key of DB_SCOPED_ENV_KEYS) {
    const value = env[key];
    if (typeof value === 'string' && isPlaceholderValue(value)) {
      return {
        ok: false,
        message: `${key} is an unconfigured placeholder; set a real value or unset it before running against ${target}.`,
      };
    }
  }

  for (const key of DB_CONNECTION_ENV_KEYS) {
    const value = env[key]?.trim();
    if (!value) {
      continue;
    }
    try {
      assertExactSupabaseProjectRef(value, expected);
    } catch (error) {
      return {
        ok: false,
        message: `${key} does not address ${target} (${expected}): ${reasonOf(error)}`,
      };
    }
    guards.push(`${key} addresses ${expected} (${target})`);
  }

  for (const key of DB_API_URL_ENV_KEYS) {
    const value = env[key]?.trim();
    if (!value) {
      continue;
    }
    try {
      assertExactSupabaseApiProjectRef(value, expected);
    } catch (error) {
      return {
        ok: false,
        message: `${key} does not address ${target} (${expected}): ${reasonOf(error)}`,
      };
    }
    guards.push(`${key} addresses ${expected} (${target})`);
  }

  if (input.linkedSourceRoot !== undefined) {
    const linked = readLinkedProjectRef(input.linkedSourceRoot);
    if (!linked) {
      return {
        ok: false,
        message: `No linked Supabase project (missing ${LINKED_PROJECT_REF_RELATIVE_PATH}); link the ${target} project before remote database work.`,
      };
    }
    if (linked !== expected) {
      return {
        ok: false,
        message: `Linked Supabase project ref does not match ${target}: expected ${expected}, linked ${linked}.`,
      };
    }
    guards.push(`${LINKED_PROJECT_REF_RELATIVE_PATH} names ${expected} (${target})`);
  }

  const appEnv = env.APP_ENV?.trim();
  if (target === 'production' && appEnv && appEnv !== 'production') {
    guards.push(
      'APP_ENV does not select the database target; production writes require CONFIRM_PRODUCTION=true',
    );
  }

  return { ok: true, guards };
}
