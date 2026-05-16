import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readScript(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('destructive maintenance script atomicity', () => {
  it('runs booking purges inside one transaction and collects ids after BEGIN', () => {
    const source = readScript('scripts/purge-restaurant-bookings.ts');
    const transactionBody = source.slice(
      source.indexOf('async function purgeBookingsInTransaction'),
    );

    expect(source).toContain('assertProductionScriptSafety');
    expect(source).toContain('SUPABASE_DB_URL');
    expect(source).toContain('purgeBookingsInTransaction');
    expect(source).not.toContain('await deleteByIds(supabase');
    expect(transactionBody).toContain("await client.query('begin')");
    expect(transactionBody).toContain('select id from public.bookings');
    expect(transactionBody).toContain('for update');
    expect(transactionBody).toContain('delete from public.bookings where id = any($1::uuid[])');
    expect(transactionBody).toContain("await client.query('commit')");
    expect(transactionBody).toContain("await client.query('rollback')");
    expect(transactionBody.indexOf("await client.query('begin')")).toBeLessThan(
      transactionBody.indexOf('select id from public.bookings'),
    );
    expect(transactionBody.indexOf('select id from public.bookings')).toBeLessThan(
      transactionBody.indexOf('delete from public.bookings where id = any($1::uuid[])'),
    );
  });

  it('runs Railway table replacement as one transaction with rollback', () => {
    const source = readScript('scripts/update-railway-zones-tables.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertProductionScriptSafety');
    expect(source).toContain('SUPABASE_DB_URL');
    expect(source).not.toContain('createClient(');
    expect(mainBody).toContain("await client.query('begin')");
    expect(mainBody).toContain('await resolveRestaurantId(client)');
    expect(mainBody).toContain('await clearExisting(client, restaurantId)');
    expect(mainBody).toContain('await insertTables(client, tables)');
    expect(mainBody).toContain("await client.query('commit')");
    expect(mainBody).toContain("await client.query('rollback')");
    expect(mainBody.indexOf("await client.query('begin')")).toBeLessThan(
      mainBody.indexOf('await clearExisting(client, restaurantId)'),
    );
    expect(mainBody.indexOf('await clearExisting(client, restaurantId)')).toBeLessThan(
      mainBody.indexOf('await insertTables(client, tables)'),
    );
    expect(mainBody.indexOf('await insertServicePeriods(client, restaurantId)')).toBeLessThan(
      mainBody.indexOf("await client.query('commit')"),
    );
  });
});
