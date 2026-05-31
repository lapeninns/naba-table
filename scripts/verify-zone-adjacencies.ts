import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { getPgSslConfig } from './db/pg-ssl';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL.');
  process.exit(1);
}

const OUT_PATH = process.env.OUT_PATH?.trim() || null;
const RESTAURANT_SLUG = process.env.RESTAURANT_SLUG?.trim() || null;

type ZoneRow = { id: string; restaurant_id: string; active: boolean | null };

type TableRow = {
  id: string;
  restaurant_id: string;
  zone_id: string | null;
  active: boolean | null;
  capacity: number | null;
  mobility: string | null;
  status: string | null;
  zone_active: boolean | null;
};

type AdjacencyRow = { table_a: string; table_b: string };

type ZoneSummary = {
  zoneId: string;
  eligibleCount: number;
  expectedEdges: number;
  actualEdgesWithinZone: number;
  missingEdges: number;
  extraEdgesWithinZone: number;
};

type VerifyResult = {
  ok: boolean;
  restaurant?: { id: string; slug: string } | null;
  totals: {
    zonesChecked: number;
    tablesChecked: number;
    eligibleTables: number;
    expectedEdges: number;
    actualEdges: number;
    missingEdges: number;
    extraEdges: number;
    crossRestaurantEdges: number;
  };
  zones: ZoneSummary[];
  samples: {
    missing: string[];
    extra: string[];
    crossRestaurant: string[];
  };
};

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isEligible(table: TableRow): boolean {
  if (!table.zone_id) return false;
  if (table.zone_active === false) return false;
  if (table.active === false) return false;
  if (!Number.isFinite(table.capacity ?? NaN) || (table.capacity ?? 0) <= 0) return false;

  const status = normalizeLower(table.status || 'available');
  if (status === 'out_of_service' || status === 'maintenance') return false;

  const mobility = normalizeLower(table.mobility || 'movable');
  // Treat unknown/legacy mobility as movable; only explicit fixed is non-mergeable.
  if (mobility === 'fixed') return false;
  return true;
}

function buildExpectedEdgesByZone(eligibleByZone: Map<string, string[]>): Set<string> {
  const expected = new Set<string>();
  for (const ids of eligibleByZone.values()) {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = 0; j < ids.length; j += 1) {
        if (i === j) continue;
        expected.add(`${ids[i]}|${ids[j]}`);
      }
    }
  }
  return expected;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString, ssl: getPgSslConfig() });
  await client.connect();

  try {
    let restaurant: { id: string; slug: string } | null = null;
    if (RESTAURANT_SLUG) {
      const res = await client.query<{ id: string; slug: string }>(
        'select id, slug from public.restaurants where slug = $1',
        [RESTAURANT_SLUG],
      );
      restaurant = res.rows[0] ?? null;
      if (!restaurant) {
        throw new Error(`Restaurant slug not found: ${RESTAURANT_SLUG}`);
      }
    }

    const zonesRes = await client.query<ZoneRow>(
      restaurant
        ? 'select id, restaurant_id, active from public.zones where restaurant_id = $1'
        : 'select id, restaurant_id, active from public.zones',
      restaurant ? [restaurant.id] : [],
    );
    const zones = zonesRes.rows;

    const tablesRes = await client.query<TableRow>(
      restaurant
        ? `
          select
            ti.id,
            ti.restaurant_id,
            ti.zone_id,
            ti.active,
            ti.capacity,
            ti.mobility,
            ti.status,
            z.active as zone_active
          from public.table_inventory ti
          left join public.zones z on z.id = ti.zone_id
          where ti.restaurant_id = $1
        `
        : `
          select
            ti.id,
            ti.restaurant_id,
            ti.zone_id,
            ti.active,
            ti.capacity,
            ti.mobility,
            ti.status,
            z.active as zone_active
          from public.table_inventory ti
          left join public.zones z on z.id = ti.zone_id
        `,
      restaurant ? [restaurant.id] : [],
    );
    const tables = tablesRes.rows;

    const tableIds = tables.map((t) => t.id);
    const tableIdSet = new Set(tableIds);

    const eligibleByZone = new Map<string, string[]>();
    let eligibleTables = 0;
    for (const table of tables) {
      if (!isEligible(table)) continue;
      eligibleTables += 1;
      const zoneId = table.zone_id as string;
      const list = eligibleByZone.get(zoneId) ?? [];
      list.push(table.id);
      eligibleByZone.set(zoneId, list);
    }

    const expected = buildExpectedEdgesByZone(eligibleByZone);

    const adjacencyRes = tableIds.length
      ? await client.query<AdjacencyRow>(
          'select table_a, table_b from public.table_adjacencies where table_a = any($1::uuid[]) or table_b = any($1::uuid[])',
          [tableIds],
        )
      : { rows: [] as AdjacencyRow[] };

    const actual = new Set<string>();
    const extras = new Set<string>();
    const crossRestaurantEdges = new Set<string>();
    for (const row of adjacencyRes.rows) {
      if (!row.table_a || !row.table_b) continue;
      if (!tableIdSet.has(row.table_a) || !tableIdSet.has(row.table_b)) {
        crossRestaurantEdges.add(`${row.table_a}|${row.table_b}`);
        continue;
      }
      if (row.table_a === row.table_b) {
        extras.add(`${row.table_a}|${row.table_b}`);
        continue;
      }
      const key = `${row.table_a}|${row.table_b}`;
      actual.add(key);
      if (!expected.has(key)) {
        extras.add(key);
      }
    }

    const missing: string[] = [];
    for (const key of expected) {
      if (!actual.has(key)) missing.push(key);
    }

    const zoneSummaries: ZoneSummary[] = [];
    let expectedEdgesTotal = 0;
    let actualWithinZonesTotal = 0;

    for (const zone of zones) {
      const ids = eligibleByZone.get(zone.id) ?? [];
      const n = ids.length;
      const expectedEdges = n * (n - 1);
      expectedEdgesTotal += expectedEdges;

      const idSet = new Set(ids);
      let actualEdgesWithinZone = 0;
      let extraEdgesWithinZone = 0;
      // Count edges where both endpoints are eligible in this zone.
      for (const a of ids) {
        for (const b of ids) {
          if (a === b) continue;
          if (actual.has(`${a}|${b}`)) actualEdgesWithinZone += 1;
        }
      }
      // Count extras that are fully inside this zone's eligible set.
      for (const key of extras) {
        const [a, b] = key.split('|');
        if (a && b && idSet.has(a) && idSet.has(b)) extraEdgesWithinZone += 1;
      }

      actualWithinZonesTotal += actualEdgesWithinZone;

      // Missing within zone is the delta between expected and actual within-zone.
      const missingEdges = Math.max(expectedEdges - actualEdgesWithinZone, 0);

      zoneSummaries.push({
        zoneId: zone.id,
        eligibleCount: n,
        expectedEdges,
        actualEdgesWithinZone,
        missingEdges,
        extraEdgesWithinZone,
      });
    }

    const result: VerifyResult = {
      ok: missing.length === 0 && extras.size === 0,
      restaurant,
      totals: {
        zonesChecked: zones.length,
        tablesChecked: tables.length,
        eligibleTables,
        expectedEdges: expectedEdgesTotal,
        actualEdges: actualWithinZonesTotal,
        missingEdges: missing.length,
        extraEdges: extras.size,
        crossRestaurantEdges: crossRestaurantEdges.size,
      },
      zones: zoneSummaries,
      samples: {
        missing: missing.slice(0, 25),
        extra: Array.from(extras).slice(0, 25),
        crossRestaurant: Array.from(crossRestaurantEdges).slice(0, 25),
      },
    };
    result.ok = result.ok && crossRestaurantEdges.size === 0;

    const serialized = JSON.stringify(result, null, 2);
    if (OUT_PATH) {
      fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
      fs.writeFileSync(OUT_PATH, serialized, 'utf8');
    } else {
      console.log(serialized);
    }

    if (!result.ok) {
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[verify-zone-adjacencies] Failed: ${message}`);
  process.exit(1);
});
