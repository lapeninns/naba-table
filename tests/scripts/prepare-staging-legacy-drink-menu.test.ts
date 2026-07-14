import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const preparationPath = path.join(projectRoot, 'scripts/db/prepare-staging-legacy-drink-menu.sql');
const sql = existsSync(preparationPath) ? readFileSync(preparationPath, 'utf8') : '';

describe('staging legacy drink-menu preservation SQL', () => {
  it('archives exact JSON for every table retired by the historical migration @contract', () => {
    // Given: five legacy tables are retired by the blocked historical migration.
    const sourceTables = [
      'restaurant_drink_menu_items',
      'restaurant_drink_menu_modifier_groups',
      'restaurant_drink_menu_modifier_options',
      'restaurant_menu_modifier_groups',
      'restaurant_menu_modifier_options',
    ];

    // When: the staging preparation contract is inspected.
    // Then: it creates a restricted archive and captures exact row JSON from every source.
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS archive');
    expect(sql).toContain('archive.restaurant_menu_legacy_rows');
    expect(sql).toContain('to_jsonb(source_row)');
    for (const table of sourceTables) {
      expect(sql).toContain(`'${table}'`);
      expect(sql).toContain(`public.${table} AS source_row`);
    }
    expect(sql).toMatch(/REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE archive\.restaurant_menu_legacy_rows/i);
  });

  it('asserts archive and canonical drink parity before any deletion @contract', () => {
    // Given: destructive retirement is permitted only after preservation and canonicalization.
    const firstDeleteOffset = sql.indexOf('DELETE FROM public.');
    const archiveParityOffset = sql.indexOf('Archive parity failed');
    const canonicalItemParityOffset = sql.indexOf('Canonical drink item parity failed');
    const canonicalExtensionParityOffset = sql.indexOf('Canonical drink extension parity failed');

    // When: the transaction order is inspected.
    // Then: all three fail-closed assertions precede the first delete.
    expect(archiveParityOffset).toBeGreaterThan(-1);
    expect(canonicalItemParityOffset).toBeGreaterThan(archiveParityOffset);
    expect(canonicalExtensionParityOffset).toBeGreaterThan(canonicalItemParityOffset);
    expect(firstDeleteOffset).toBeGreaterThan(canonicalExtensionParityOffset);
    expect(sql).toContain("canonical.external_item_id = 'drink:' || legacy.external_drink_id");
    expect(sql).toContain("canonical.item_kind = 'drink'");
    expect(sql).toContain('public.restaurant_menu_item_extensions');
    expect(sql).toContain('RAISE EXCEPTION');
  });

  it('deletes in foreign-key order and verifies the legacy tables are empty @contract', () => {
    // Given: modifier options depend on groups, and drink groups depend on drink items.
    const expectedDeleteOrder = [
      'DELETE FROM public.restaurant_drink_menu_modifier_options',
      'DELETE FROM public.restaurant_drink_menu_modifier_groups',
      'DELETE FROM public.restaurant_drink_menu_items',
      'DELETE FROM public.restaurant_menu_modifier_options',
      'DELETE FROM public.restaurant_menu_modifier_groups',
    ];

    // When: the destructive section is inspected.
    // Then: child rows precede parents and a zero-row assertion precedes commit.
    let previousOffset = -1;
    for (const statement of expectedDeleteOrder) {
      const offset = sql.indexOf(statement);
      expect(offset).toBeGreaterThan(previousOffset);
      previousOffset = offset;
    }
    expect(sql.indexOf('Legacy retirement preparation failed')).toBeGreaterThan(previousOffset);
    expect(sql.lastIndexOf('COMMIT;')).toBeGreaterThan(
      sql.indexOf('Legacy retirement preparation failed'),
    );
    expect(sql).not.toMatch(/\b(?:TRUNCATE|DROP TABLE)\b/i);
  });
});
