import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_PRODUCTION_PROJECT_REF,
  DEFAULT_STAGING_PROJECT_REF,
  assertExactSupabaseApiProjectRef,
  assertExactSupabaseProjectRef,
} from '../safety';

/**
 * Remote target validation for the promotion-safety workflows in scripts/db/safe-run.ts.
 *
 * Every remote operation must prove, before any child process runs, that:
 *  - the Supabase CLI link state (supabase/.temp/project-ref) names the expected project,
 *  - any database connection string points at that same project (host or pooler user),
 *  - any API URL points at that same project.
 *
 * Missing evidence is a refusal, never a fallback.
 */

export type RemoteTarget = 'staging' | 'production';

export const TARGET_PROJECT_REFS: Readonly<Record<RemoteTarget, string>> = {
  staging: DEFAULT_STAGING_PROJECT_REF,
  production: DEFAULT_PRODUCTION_PROJECT_REF,
};

export const LINKED_PROJECT_REF_RELATIVE_PATH = path.join('supabase', '.temp', 'project-ref');

export type TargetValidationInput = {
  readonly target: RemoteTarget;
  /** Content of supabase/.temp/project-ref, or null when the file is absent. */
  readonly linkedProjectRef: string | null;
  readonly databaseUrl?: string;
  readonly apiUrl?: string;
  readonly requireDatabaseUrl?: boolean;
};

export type TargetValidation =
  | { readonly ok: true; readonly projectRef: string; readonly databaseRole: string | null }
  | { readonly ok: false; readonly message: string };

export function isRemoteTarget(value: string | undefined): value is RemoteTarget {
  return value === 'staging' || value === 'production';
}

export function expectedProjectRef(target: RemoteTarget): string {
  return TARGET_PROJECT_REFS[target];
}

export function readLinkedProjectRef(workdir: string): string | null {
  const refPath = path.join(workdir, LINKED_PROJECT_REF_RELATIVE_PATH);
  if (!existsSync(refPath)) {
    return null;
  }
  const content = readFileSync(refPath, 'utf8').trim().toLowerCase();
  return content.length > 0 ? content : null;
}

/**
 * Extract the database role from a connection string without exposing the password.
 * Supabase pooler users are `<role>.<projectRef>`; direct hosts use the bare role.
 */
export function extractDatabaseRole(connectionString: string): string | null {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return null;
  }
  const user = decodeURIComponent(url.username);
  if (!user) {
    return null;
  }
  const poolerMatch = user.match(/^([a-z_][a-z0-9_]*)\.[a-z0-9]{20}$/i);
  return poolerMatch ? poolerMatch[1] : user;
}

export function validateRemoteTarget(input: TargetValidationInput): TargetValidation {
  const expected = expectedProjectRef(input.target);
  if (!input.linkedProjectRef) {
    return {
      ok: false,
      message: `No linked Supabase project (missing ${LINKED_PROJECT_REF_RELATIVE_PATH}); link the ${input.target} project before remote database work.`,
    };
  }
  if (input.linkedProjectRef !== expected) {
    return {
      ok: false,
      message: `Linked Supabase project ref does not match ${input.target}: expected ${expected}, linked ${input.linkedProjectRef}.`,
    };
  }

  let databaseRole: string | null = null;
  if (input.databaseUrl) {
    try {
      assertExactSupabaseProjectRef(input.databaseUrl, expected);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `Database connection does not match ${input.target} (${expected}): ${reason}`,
      };
    }
    databaseRole = extractDatabaseRole(input.databaseUrl);
    if (!databaseRole) {
      return {
        ok: false,
        message: `Database connection for ${input.target} has no recognisable role in its user.`,
      };
    }
  } else if (input.requireDatabaseUrl) {
    return {
      ok: false,
      message: `SUPABASE_DB_URL (or DATABASE_URL) for ${input.target} is required by this workflow.`,
    };
  }

  if (input.apiUrl) {
    try {
      assertExactSupabaseApiProjectRef(input.apiUrl, expected);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `Supabase API URL does not match ${input.target} (${expected}): ${reason}`,
      };
    }
  }

  return { ok: true, projectRef: expected, databaseRole };
}

export function databaseUrlFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  return env.SUPABASE_DB_URL?.trim() || env.DATABASE_URL?.trim() || undefined;
}

export function apiUrlFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  return env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}
