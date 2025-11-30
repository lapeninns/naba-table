
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function checkAdjacencyData() {
    const restaurantId = "486de541-a307-4414-b0b1-f774a0e4a9fa";

    console.log("\n" + "=".repeat(80));
    console.log("🔍 ADJACENCY DIAGNOSTICS");
    console.log("=".repeat(80));

    // Get all movable tables
    const { data: movableTables } = await supabase
        .from("table_inventory")
        .select("id, table_number, capacity, mobility")
        .eq("restaurant_id", restaurantId)
        .eq("mobility", "movable");

    console.log(`\n📊 Movable Tables: ${movableTables?.length || 0}`);

    const tableIds = movableTables?.map(t => t.id) || [];

    // Check adjacency edges
    const { data: edges } = await supabase
        .from("table_adjacencies")
        .select("*")
        .in("table_a", tableIds);

    console.log(`\n🔗 Adjacency Edges: ${edges?.length || 0}`);

    if (!edges || edges.length === 0) {
        console.log("\n⚠️  WARNING: NO ADJACENCY EDGES FOUND!");
        console.log("   This is why the combination planner is failing.");
        console.log("   All tables need adjacency relationships to be combined.");
        console.log("\n   SOLUTION: Either:");
        console.log("   1. Populate table_adjacencies with edge relationships");
        console.log("   2. Disable adjacency requirement for large parties");
        console.log("   3. Override requireAdjacency=false in the booking flow");
    } else {
        console.log("\n✅ Adjacency edges exist:");

        // Group by table
        const edgesByTable = new Map<string, number>();
        edges.forEach(edge => {
            const current = edgesByTable.get(edge.table_a) || 0;
            edgesByTable.set(edge.table_a, current + 1);
        });

        console.log(`\n   Tables with edges: ${edgesByTable.size} / ${tableIds.length}`);
        console.log(`   Average edges per table: ${(edges.length / tableIds.length).toFixed(1)}`);

        // Find tables with no edges
        const tablesWithoutEdges = movableTables?.filter(
            t => !edgesByTable.has(t.id)
        );

        if (tablesWithoutEdges && tablesWithoutEdges.length > 0) {
            console.log(`\n   ⚠️  ${tablesWithoutEdges.length} tables have NO edges:`);
            tablesWithoutEdges.forEach(t => {
                console.log(`      - ${t.table_number}`);
            });
        }
    }

    // Check feature flags
    console.log("\n⚙️  FEATURE FLAGS:");
    console.log(`   COMBINATION_PLANNER: ${process.env.FEATURE_COMBINATION_PLANNER}`);
    console.log(`   ALLOCATOR_K_MAX: ${process.env.FEATURE_ALLOCATOR_K_MAX || '(default)'}`);
    console.log(`   ALLOCATOR_ADJACENCY_REQUIRED: ${process.env.FEATURE_ALLOCATOR_ADJACENCY_REQUIRED || '(default)'}`);
    console.log(`   ADJACENCY_MIN_PARTY_SIZE: ${process.env.FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE || '(default)'}`);

    console.log("\n" + "=".repeat(80));
    console.log("\n");
}

checkAdjacencyData().catch(console.error);
