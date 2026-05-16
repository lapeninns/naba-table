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

    expect(body).toContain('replaceCoreBusinessContext');
    expect(read('server/restaurants/businessContext.ts')).toContain(
      'replace_restaurant_business_context_core',
    );
    expect(body).not.toContain('.delete()');
    expect(body).not.toContain('.insert(');
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
