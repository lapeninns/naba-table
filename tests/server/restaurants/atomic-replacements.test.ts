import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }
  const nextExport = source.indexOf('\nexport ', start + 1);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

describe('restaurant replacement helpers', () => {
  it('uses RPC replacement instead of delete-then-insert for operating hours', () => {
    const body = extractFunction(
      read('server/restaurants/operatingHours.ts'),
      'updateOperatingHours',
    );

    expect(body).toContain('replace_restaurant_operating_hours');
    expect(body).not.toContain('.delete()');
    expect(body).not.toContain('.insert(');
  });

  it('uses RPC replacement instead of delete-then-insert for service periods', () => {
    const body = extractFunction(
      read('server/restaurants/servicePeriods.ts'),
      'updateServicePeriods',
    );

    expect(body).toContain('replace_restaurant_service_periods');
    expect(body).not.toContain('.delete()');
    expect(body).not.toContain('.insert(');
  });

  it('uses RPC replacement instead of delete-then-insert for turn bands', () => {
    const body = extractFunction(
      read('server/restaurants/turnBands.ts'),
      'replaceRestaurantTurnBands',
    );

    expect(body).toContain('replace_restaurant_turn_bands');
    expect(body).not.toContain('.delete()');
    expect(body).not.toContain('.insert(');
  });

  it('uses RPC replacement instead of delete-then-insert for business context families', () => {
    const body = extractFunction(
      read('server/restaurants/businessContext.ts'),
      'updateRestaurantBusinessContext',
    );

    const source = read('server/restaurants/businessContext.ts');
    // The save goes through the transactional v2 RPC (families + change log + revision in one
    // transaction); the family tables are never cleared and refilled from the app.
    expect(body).toContain('replaceBusinessContextAtomically');
    expect(body).not.toContain('.delete()');
    expect(body).not.toContain('.insert(');

    const atomicStart = source.indexOf('async function replaceBusinessContextAtomically');
    expect(atomicStart).toBeGreaterThan(-1);
    const atomicEnd = source.indexOf('\nasync function ', atomicStart + 1);
    const atomicBody = source.slice(atomicStart, atomicEnd === -1 ? undefined : atomicEnd);
    expect(atomicBody).toContain('replace_restaurant_business_context_v2');
    // The pre-v2 fallback still replaces the families by RPC, never by delete-then-insert.
    expect(atomicBody).toContain('replace_restaurant_business_context_core');
    expect(atomicBody).not.toContain('.delete()');
    expect(atomicBody).not.toContain('.from(');
  });

  it('defines a service-role-only transactional v2 save for business context', () => {
    const migration = read('supabase/migrations/20260927170000_business_context_atomic_save.sql');

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.replace_restaurant_business_context_v2',
    );
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public');
    expect(migration).toContain('PERFORM public.replace_restaurant_business_context_core(');
    expect(migration).toContain('INSERT INTO public.restaurant_profile_change_log');
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.replace_restaurant_business_context_v2\([^)]*\) FROM authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.replace_restaurant_business_context_v2\([^)]*\) TO service_role/,
    );
  });

  it('defines service-role-only replacement RPCs for all schedule tables', () => {
    const migration = read(
      'supabase/migrations/20260516082800_atomic_restaurant_schedule_replacements.sql',
    );

    for (const fn of [
      'replace_restaurant_operating_hours',
      'replace_restaurant_service_periods',
      'replace_restaurant_turn_bands',
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      expect(migration).toContain(
        `REVOKE ALL ON FUNCTION public.${fn}(uuid, jsonb) FROM authenticated`,
      );
      expect(migration).toContain(
        `GRANT EXECUTE ON FUNCTION public.${fn}(uuid, jsonb) TO service_role`,
      );
    }
  });

  it('defines a service-role-only replacement RPC for business context families', () => {
    const migration = read(
      'supabase/migrations/20260516082900_atomic_business_context_replacements.sql',
    );

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.replace_restaurant_business_context_core',
    );
    expect(migration).toContain('DELETE FROM public.restaurant_links');
    expect(migration).toContain('INSERT INTO public.restaurant_links');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.replace_restaurant_business_context_core',
    );
    expect(migration).toContain('FROM authenticated');
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.replace_restaurant_business_context_core',
    );
    expect(migration).toContain('TO service_role');
  });
});
