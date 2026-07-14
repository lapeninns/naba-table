import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sql = readFileSync(
  path.join(projectRoot, 'scripts/db/remove-staging-test-phone.sql'),
  'utf8',
);
const runner = readFileSync(
  path.join(projectRoot, 'scripts/db/remove-staging-test-phone.ts'),
  'utf8',
);

describe('staging legacy test-phone cleanup', () => {
  it('keeps the runtime phone out of checked-in SQL and validates E.164 before substitution @contract', () => {
    expect(sql).toContain('__TEST_PHONE_E164__');
    expect(runner).toContain('TEST_PHONE_E164');
    expect(runner).toContain('/^\\+[1-9]\\d{6,14}$/');
    expect(runner).toContain('fileURLToPath(import.meta.url)');
    expect(runner).toContain("sql.replaceAll('__TEST_PHONE_E164__', targetPhone)");
    expect(runner).toContain("['db', 'query', '--linked', '--file'");
  });

  it('anonymizes required rows and clears dependent consent without deleting guests @contract', () => {
    expect(sql).toContain('UPDATE public.bookings');
    expect(sql).toContain('UPDATE public.customers');
    expect(sql).not.toContain('phone_normalized = customer_replacements');
    expect(sql).not.toMatch(/DELETE FROM public\.(bookings|customers)/);
    expect(sql).toContain('+447700900');
    expect(sql).toContain('whatsapp_opt_in = false');
    expect(sql).toContain('whatsapp_consent_phone = NULL');
    expect(sql).toContain('manager_daily_summary_enabled = false');
    expect(sql).toContain('manager_whatsapp_enabled = false');
    expect(sql).toContain('DELETE FROM public.restaurant_phone_numbers');
  });

  it('runs atomically and refuses to commit while any public phone field retains the target @contract', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/COMMIT;\s*$/);
    expect(sql).toContain("column_name ILIKE '%phone%'");
    expect(sql).toContain("RAISE EXCEPTION 'Legacy test phone remains");
    expect(sql).toContain("RAISE EXCEPTION 'Reserved synthetic phone collision");
    expect(sql.indexOf('Legacy test phone remains')).toBeLessThan(sql.indexOf('COMMIT;'));
  });
});
