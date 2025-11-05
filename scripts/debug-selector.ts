#!/usr/bin/env tsx
/**
 * Deep selector debug for a real booking.
 *
 * Usage examples:
 *  - DEBUG_SLUG=the-corner-house-pub-cambridge DEBUG_MIN_PARTY=10 pnpm tsx -r tsconfig-paths/register scripts/debug-selector.ts
 *  - DEBUG_BOOKING_ID=<uuid> pnpm tsx -r tsconfig-paths/register scripts/debug-selector.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

process.env.CAPACITY_DEBUG = process.env.CAPACITY_DEBUG || '1';

import { DateTime } from 'luxon';
import type { SelectorScoringConfig } from '@/server/capacity/policy';

async function main() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();

  const bookingIdEnv = process.env.DEBUG_BOOKING_ID || '';
  let bookingId = bookingIdEnv.trim().length > 0 ? bookingIdEnv.trim() : null;

  let booking: any | null = null;
  if (bookingId) {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
    booking = data as any;
  } else {
    const slug = process.env.DEBUG_SLUG || 'the-corner-house-pub-cambridge';
    const minParty = Math.max(1, Number(process.env.DEBUG_MIN_PARTY || 1));
    const today = new Date().toISOString().slice(0, 10);

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!restaurant) throw new Error(`Restaurant not found for slug=${slug}`);

    const { data: rows } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, party_size, status')
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'pending')
      .gte('party_size', minParty)
      .gte('booking_date', today)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1);

    booking = (rows || [])[0] as any;
    if (!booking) {
      console.log(`No pending bookings found >= party ${minParty} from ${today} for ${slug}`);
      return;
    }
    bookingId = booking.id;
  }

  const tablesModule = await import('@/server/capacity/tables');
  const policyModule = await import('@/server/capacity/policy');
  const featureFlags = await import('@/server/feature-flags');
  const strategic = await import('@/server/capacity/strategic-config');
  const demand = await import('@/server/capacity/demand-profiles');
  const scarcity = await import('@/server/capacity/scarcity');
  const selector = await import('@/server/capacity/selector');

  // Load booking fresh with relations to get timezone
  const { data: full } = await supabase
    .from('bookings')
    .select('*, restaurants(id, timezone)')
    .eq('id', bookingId!)
    .maybeSingle();
  if (!full) throw new Error('Booking not found');

  const restaurantTz = full.restaurants?.timezone || policyModule.getVenuePolicy().timezone;
  const policy = policyModule.getVenuePolicy({ timezone: restaurantTz });

  // Compute window like quoteTablesForBooking
  const { computeBookingWindow } = await import('@/server/capacity/tables');
  let window: any;
  try {
    window = computeBookingWindow({
      startISO: full.start_at,
      bookingDate: full.booking_date,
      startTime: full.start_time,
      partySize: full.party_size,
      policy,
    });
  } catch (e) {
    console.error('[debug-selector] computeBookingWindow failed:', (e as Error)?.message || e);
    return;
  }

  // Load tables directly from DB
  const TABLE_SELECT = 'id,table_number,capacity,min_party_size,max_party_size,section,category,seating_type,mobility,zone_id,status,active,position';
  const { data: tableRows, error: tablesError } = await supabase
    .from('table_inventory')
    .select(TABLE_SELECT)
    .eq('restaurant_id', full.restaurant_id);
  if (tablesError) throw new Error(tablesError.message);
  const tables = (tableRows || []).map((row: any) => ({
    id: row.id,
    tableNumber: row.table_number,
    capacity: row.capacity ?? 0,
    minPartySize: row.min_party_size ?? null,
    maxPartySize: row.max_party_size ?? null,
    section: row.section,
    category: row.category,
    seatingType: row.seating_type,
    mobility: row.mobility,
    zoneId: row.zone_id,
    status: row.status,
    active: row.active,
    position: row.position,
  }));

  // Build adjacency map
  const ids = tables.map((t: any) => t.id);
  const adjacencyUndirected = featureFlags.isAdjacencyQueryUndirected();
  const baseAdjQuery = () => supabase.from('table_adjacencies').select('table_a, table_b');
  const forward = await baseAdjQuery().in('table_a', ids);
  const reverse = adjacencyUndirected ? await baseAdjQuery().in('table_b', ids) : null;
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string | null, b: string | null) => {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  const forwardRows = Array.isArray(forward.data) ? forward.data as Array<{ table_a: string|null; table_b: string|null }> : [];
  for (const r of forwardRows) addEdge(r.table_a, r.table_b);
  if (adjacencyUndirected && reverse && Array.isArray(reverse.data)) {
    const reverseRows = reverse.data as Array<{ table_a: string|null; table_b: string|null }>;
    for (const r of reverseRows) addEdge(r.table_b, r.table_a);
  }

  // Strategic + feature flags
  await strategic.loadStrategicConfig({ restaurantId: full.restaurant_id, client: supabase as any });
  const combinationEnabled = featureFlags.isCombinationPlannerEnabled();

  // Filter with allowMaxPartySizeViolation
  const filtered = tablesModule.filterAvailableTables(
    tables as any,
    full.party_size,
    window as any,
    adjacency as any,
    undefined,
    undefined,
    { allowInsufficientCapacity: true, allowMaxPartySizeViolation: combinationEnabled },
  );

  const selectorLimits = featureFlags.getSelectorPlannerLimits();
  const combinationLimit = featureFlags.getAllocatorKMax ? featureFlags.getAllocatorKMax() : 3;
  const requireAdjacency = (() => {
    const min = featureFlags.getAllocatorAdjacencyMinPartySize();
    const global = featureFlags.isAllocatorAdjacencyRequired();
    return global && (typeof min === 'number' ? full.party_size >= min : true);
  })();

  const baseScoring = policyModule.getSelectorScoringConfig({ restaurantId: full.restaurant_id });
  const scoringConfig = {
    ...baseScoring,
    weights: {
      ...baseScoring.weights,
      scarcity: policyModule.getYieldManagementScarcityWeight({ restaurantId: full.restaurant_id }),
    },
  } as SelectorScoringConfig;

  const demandMultResult = await demand.resolveDemandMultiplier({
    restaurantId: full.restaurant_id,
    serviceStart: window.block.start,
    serviceKey: window.service,
    timezone: policy.timezone,
    client: supabase as any,
  });
  const tableScarcityScores = await scarcity.loadTableScarcityScores({
    restaurantId: full.restaurant_id,
    tables: filtered,
    client: supabase as any,
  });

  const result = selector.buildScoredTablePlans({
    tables: filtered,
    partySize: full.party_size,
    adjacency,
    config: scoringConfig,
    enableCombinations: combinationEnabled,
    kMax: combinationLimit,
    maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
    maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
    enumerationTimeoutMs: selectorLimits.enumerationTimeoutMs,
    requireAdjacency,
    demandMultiplier: demandMultResult?.multiplier ?? 1,
    tableScarcityScores,
  });

  const diagnostics = result.diagnostics;
  const plans = result.plans.map((p) => ({
    tableCount: p.tables.length,
    totalCapacity: p.totalCapacity,
    slack: p.slack,
    adjacency: p.adjacencyStatus,
    score: p.score,
  }));

  console.log('\n=== DEBUG SELECTOR REPORT ===');
  console.log({
    booking: {
      id: full.id,
      date: full.booking_date,
      time: full.start_time,
      party: full.party_size,
      timezone: policy.timezone,
    },
    input: {
      tables: tables.length,
      filtered: filtered.length,
      combinationEnabled,
      kMax: combinationLimit,
      requireAdjacency,
    },
    diagnostics: {
      singles: diagnostics.singlesConsidered,
      combosEnumerated: diagnostics.combinationsEnumerated,
      combosAccepted: diagnostics.combinationsAccepted,
      skipped: diagnostics.skipped,
      performance: diagnostics.performance,
    },
    topPlans: plans.slice(0, 5),
  });
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e);
  process.exit(1);
});
