import { Client } from 'pg';

import { getPgSslConfig } from './db/pg-ssl';

const regions = [
  'eu-west-2',
  'eu-west-1',
  'eu-central-1',
  'us-east-1',
  'us-west-2',
  'ap-southeast-1',
];
const projectRef = (process.env.SUPABASE_PROJECT_REF || process.argv[2] || '').trim();
const password = (process.env.SUPABASE_DB_PASSWORD || '').trim();

async function findRegion() {
  if (!projectRef || !password) {
    console.error('Missing required inputs.');
    console.error('');
    console.error('Usage:');
    console.error(
      '  SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... npx tsx scripts/find-supabase-region.ts',
    );
    process.exit(1);
  }

  for (const region of regions) {
    console.log(`Checking region: ${region}...`);
    const client = new Client({
      connectionString: `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
      connectionTimeoutMillis: 5000,
      ssl: getPgSslConfig(),
    });

    try {
      await client.connect();
      console.log(`✅ FOUND! Project is in region: ${region}`);
      await client.end();
      process.exit(0);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Tenant or user not found')) {
        console.log(`   ❌ Not in ${region}`);
      } else {
        console.log(
          `   ⚠️  Error in ${region}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } finally {
      await client.end().catch(() => {});
    }
  }
}

findRegion();
