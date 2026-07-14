import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const targetPhone = process.env.TEST_PHONE_E164 ?? '';
if (!/^\+[1-9]\d{6,14}$/.test(targetPhone)) {
  process.stderr.write('TEST_PHONE_E164 must be valid E.164.\n');
  process.exitCode = 2;
} else {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(scriptDirectory, 'remove-staging-test-phone.sql');
  const sql = readFileSync(templatePath, 'utf8');
  const renderedSql = sql.replaceAll('__TEST_PHONE_E164__', targetPhone);
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'nabatable-test-phone-cleanup-'));
  const renderedPath = path.join(temporaryDirectory, 'cleanup.sql');

  try {
    writeFileSync(renderedPath, renderedSql, { encoding: 'utf8', mode: 0o600 });
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', renderedPath], {
      env: process.env,
      stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}
