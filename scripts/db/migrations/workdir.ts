import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Isolated Supabase work directory for one remote run.
 *
 * The Supabase CLI reads migrations and link state from `<workdir>/supabase`. Copying that
 * tree into a fresh mkdtemp directory means a run can never be influenced by files edited
 * mid-run, and the CLI's own scratch writes never land in the repository.
 */

export const ISOLATED_WORKDIR_ENV = 'DB_ISOLATED_WORKDIR';

const COPIED_ENTRIES = ['config.toml', 'migrations', '.temp', 'seed.sql'] as const;

export type IsolatedWorkdir = {
  readonly path: string;
  readonly copied: readonly string[];
  readonly cleanup: () => void;
};

export function createIsolatedSupabaseWorkdir(
  sourceRoot: string,
  temporaryRoot: string = tmpdir(),
): IsolatedWorkdir {
  const sourceSupabase = path.join(sourceRoot, 'supabase');
  if (!existsSync(path.join(sourceSupabase, 'migrations'))) {
    throw new Error(`No supabase/migrations directory under ${sourceRoot}.`);
  }

  const directory = mkdtempSync(path.join(temporaryRoot, 'nabatable-db-run-'));
  const targetSupabase = path.join(directory, 'supabase');
  mkdirSync(targetSupabase, { mode: 0o700 });

  const copied: string[] = [];
  for (const entry of COPIED_ENTRIES) {
    const source = path.join(sourceSupabase, entry);
    if (!existsSync(source)) {
      continue;
    }
    cpSync(source, path.join(targetSupabase, entry), { recursive: true });
    copied.push(entry);
  }

  return {
    path: directory,
    copied,
    cleanup: () => rmSync(directory, { force: true, recursive: true }),
  };
}
