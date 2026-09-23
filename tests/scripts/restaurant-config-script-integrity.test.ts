import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readScript(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('restaurant config clone/triple script integrity', () => {
  it('cleans up only the restaurant inserted by the clone script and verifies adjacency rows', () => {
    const source = readScript('scripts/clone-restaurant-config.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('cleanupTargetById(restaurantId: string)');
    expect(source).not.toContain('cleanupTargetBySlug');
    expect(source).toContain('let insertedRestaurantId: string | null = null');
    expect(source).toContain('insertedRestaurantId = restaurantId');
    expect(source).toContain('await cleanupTargetById(insertedRestaurantId)');
    expect(source).toContain('mobility: table.mobility,');
    expect(source).not.toContain("mobility: table.mobility ?? 'fixed'");
    expect(source).toContain('const adjacencyProjection = projectAdjacencyRows(tables)');
    expect(source).toContain('verifyClone(adjacencyProjection.totalRows)');
    expect(source).toContain('adjacencyRows !== expectedAdjacencyRows');
    expect(mainBody.indexOf('insertedRestaurantId = restaurantId')).toBeLessThan(
      mainBody.indexOf('await cleanupTargetById(insertedRestaurantId)'),
    );
  });

  it('replaces copied Barley Mow and Prince tables only with production confirmation and guarded deletes', () => {
    const source = readScript('scripts/update-copied-venue-tables.ts');

    expect(source).toContain('CONFIRM_PRODUCTION=true is required to modify production data.');
    expect(source).toContain("process.env.APPLY === 'true'");
    expect(source).toContain("rpc('delete_table_inventory_guarded'");
    expect(source).toContain('COPIED_VENUE_TABLE_SPECS');
    expect(source).toContain('assertExactSupabaseApiProjectRef');
    expect(source).not.toContain('cleanupTargetBySlug');
  });

  it('preserves table mobility and fails closed on adjacency mismatch when tripling tables', () => {
    const source = readScript('scripts/triple-old-school-house-production-tables.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('mobility: table.mobility,');
    expect(source).not.toContain("mobility: table.mobility ?? 'fixed'");
    expect(source).toContain('verified.adjacencyRows !== finalAdjacencyProjection.totalRows');
    expect(source).toContain('await deleteInsertedTables(insertedTableIds)');
    expect(mainBody.indexOf('verified = await verifyState(restaurant.id)')).toBeLessThan(
      mainBody.indexOf('await deleteInsertedTables(insertedTableIds)'),
    );
  });
});
