import fs from 'node:fs';

import type { ConnectionConfig } from 'pg';

type PgSslConfig = Exclude<ConnectionConfig['ssl'], undefined>;

export function getPgSslConfig(env: NodeJS.ProcessEnv = process.env): PgSslConfig {
  const caFromEnv = env.SUPABASE_DB_CA_CERT?.trim();
  const caPath = env.SUPABASE_DB_CA_CERT_PATH?.trim() || env.NODE_EXTRA_CA_CERTS?.trim();

  if (caFromEnv) {
    return { rejectUnauthorized: true, ca: caFromEnv.replace(/\\n/g, '\n') };
  }

  if (caPath) {
    return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
  }

  return { rejectUnauthorized: true };
}
