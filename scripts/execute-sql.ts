import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { getPgSslConfig } from './db/pg-ssl';
import { assertStagingScriptSafety } from './db/safety';

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL. Set it before running this script.');
  process.exit(1);
}

const modulePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(modulePath);
const sqlPath = path.resolve(scriptDir, '..', 'generate_bookings.sql');

async function runSql(): Promise<void> {
  assertStagingScriptSafety({
    connectionString,
    expectedProjectRef:
      process.env.EXPECTED_PROJECT_REF ?? process.env.EXPECTED_STAGING_PROJECT_REF,
    targetEnv: process.env.DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim(),
    confirmation: process.env.CONFIRM_SQL_EXECUTION,
    confirmationName: 'CONFIRM_SQL_EXECUTION',
  });

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  if (!sql.trim()) {
    throw new Error(`SQL file is empty: ${sqlPath}`);
  }

  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(),
  });

  try {
    await client.connect();
    console.log('Connected to guarded staging database');

    await client.query(sql);
    console.log('SQL executed successfully');
  } catch (err) {
    console.error('Error executing SQL:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void runSql().catch((error) => {
  console.error('[execute-sql] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
