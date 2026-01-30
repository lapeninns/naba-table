import { execFileSync } from 'node:child_process';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function main(): void {
  const dbUrl = getRequiredEnv('DRIFT_CHECK_DB_URL');

  // This check uses Supabase CLI to diff the remote schema against migrations.
  // It is intended for CI where Supabase CLI is pre-installed.
  //
  // If drift exists, `supabase db diff` prints SQL statements for a migration.
  // If there is no drift, output is typically empty.
  let output = '';
  try {
    output = execFileSync('supabase', ['db', 'diff', '--db-url', dbUrl, '--schema', 'public'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`supabase db diff failed: ${message}`);
  }

  const trimmed = output.trim();
  if (trimmed.length === 0) {
    console.log('OK: No database drift detected.');
    return;
  }

  console.error('FAILED: Database drift detected. supabase db diff returned:');
  console.error(trimmed);
  process.exitCode = 1;
}

main();
