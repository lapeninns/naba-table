#!/usr/bin/env tsx
/**
 * Check table adjacency data
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function checkAdjacency() {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";

  console.log("\n🔍 Checking Table Adjacency Data...\n");

  // Get total tables
  const { count: tableCount } = await supabase
    .from("table_inventory")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  console.log(`📊 Total tables: ${tableCount}`);

  // Get adjacency relationships
  const { data: adjacencies, count: adjacencyCount } = await supabase
    .from("table_adjacencies")
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId);

  console.log(`🔗 Total adjacency relationships: ${adjacencyCount}`);

  if (tableCount && adjacencyCount) {
    const maxPossible = (tableCount * (tableCount - 1)) / 2;
    const coverage = ((adjacencyCount / maxPossible) * 100).toFixed(1);
    console.log(`📈 Coverage: ${adjacencyCount}/${maxPossible} (${coverage}%)`);
  }

  if (adjacencies && adjacencies.length > 0) {
    console.log("\n📋 Sample adjacencies:");
    adjacencies.slice(0, 5).forEach((adj: any) => {
      console.log(`  Table ${adj.table1_id} ↔ Table ${adj.table2_id}`);
    });
    if (adjacencies.length > 5) {
      console.log(`  ... and ${adjacencies.length - 5} more`);
    }
  } else {
    console.log("\n❌ NO ADJACENCY DATA FOUND!");
    console.log("\nThis is why table combinations aren't working.");
    console.log("The algorithm needs to know which tables are adjacent to combine them.");
  }

  console.log("\n");
}

checkAdjacency().catch(console.error);
