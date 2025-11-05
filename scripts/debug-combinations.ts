#!/usr/bin/env tsx
/**
 * Debug why table combinations aren't being used
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function debugCombinations() {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";

  console.log("\n🔍 Debugging Table Combinations...\n");

  // Get table inventory by zone and capacity
  const { data: tables } = await supabase
    .from("table_inventory")
    .select("id, table_number, capacity, zone_id, mobility")
    .eq("restaurant_id", restaurantId)
    .order("zone_id")
    .order("capacity");

  console.log("📊 Table Inventory by Zone:\n");

  const byZone = new Map<string, any[]>();
  tables?.forEach((t) => {
    const zone = t.zone_id || "no-zone";
    if (!byZone.has(zone)) {
      byZone.set(zone, []);
    }
    byZone.get(zone)!.push(t);
  });

  byZone.forEach((zoneTables, zoneId) => {
    console.log(`\nZone: ${zoneId.substring(0, 8)}`);
    
    const movable = zoneTables.filter((t) => t.mobility === "movable");
    const fixed = zoneTables.filter((t) => t.mobility === "fixed");
    
    console.log(`  Movable tables: ${movable.length}`);
    movable.forEach((t) => {
      console.log(`    - ${t.table_number} (cap ${t.capacity})`);
    });
    
    if (fixed.length > 0) {
      console.log(`  Fixed tables: ${fixed.length}`);
      fixed.forEach((t) => {
        console.log(`    - ${t.table_number} (cap ${t.capacity})`);
      });
    }
  });

  // Check for possible combinations for party of 5
  console.log("\n\n🎯 Possible Combinations for Party of 5:\n");

  byZone.forEach((zoneTables, zoneId) => {
    const movable = zoneTables.filter((t) => t.mobility === "movable");
    
    // Check 2-table combinations
    for (let i = 0; i < movable.length; i++) {
      for (let j = i + 1; j < movable.length; j++) {
        const t1 = movable[i];
        const t2 = movable[j];
        const total = t1.capacity + t2.capacity;
        
        if (total >= 5 && total <= 7) { // Good fit for party of 5
          console.log(`  Zone ${zoneId.substring(0, 8)}: ${t1.table_number} (cap ${t1.capacity}) + ${t2.table_number} (cap ${t2.capacity}) = ${total} seats`);
        }
      }
    }
  });

  console.log("\n");
}

debugCombinations().catch(console.error);
