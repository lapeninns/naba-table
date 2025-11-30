/* eslint-disable @typescript-eslint/no-explicit-any */
// Load env vars first
import { config } from "dotenv";
config({ path: ".env.local" });

import { quoteTablesForBooking } from "../server/capacity/tables";

async function testCombinationPlanner() {
    const bookingId = "97fad88e-5c58-46a8-a2db-2882b9a567be";

    console.log("\n🔍 Testing Combination Planner for Booking:", bookingId);
    console.log("=".repeat(80));

    try {
        const result = await quoteTablesForBooking({
            bookingId,
            holdTtlSeconds: 180,
            createdBy: null as any,
        });

        console.log("\n✅ Quote Result:");
        console.log("  Hold:", result.hold ? `✓ ${result.hold.id}` : "✗ No hold created");
        console.log("  Reason:", result.reason || "(none)");
        console.log("  Alternates:", result.alternates?.length || 0);

        if (result.candidate) {
            console.log("\n📊 Selected Candidate:");
            console.log("  Tables:", result.candidate.tableNumbers?.join(", "));
            console.log("  Total Capacity:", result.candidate.totalCapacity);
            console.log("  Table Count:", result.candidate.tableCount);
            console.log("  Slack:", result.candidate.slack);
            console.log("  Score:", result.candidate.score);
            console.log("  Adjacency:", result.candidate.adjacencyStatus);
        }

        if (result.plannerStats) {
            console.log("\n📈 Planner Stats:");
            console.log("  Total Tables:", result.plannerStats.totalTables);
            console.log("  Filtered Tables:", result.plannerStats.filteredTables);
            console.log("  Generated Plans:", result.plannerStats.generatedPlans);
            console.log("  Combination Enabled:", result.plannerStats.combinationEnabled);
            console.log("  Require Adjacency:", result.plannerStats.requireAdjacency);
            console.log("  Demand Multiplier:", result.plannerStats.demandMultiplier);
            console.log("  Duration:", `${result.plannerStats.plannerDurationMs}ms`);
        }

        if (result.skipped && result.skipped.length > 0) {
            console.log("\n⚠️  Skipped Candidates:");
            result.skipped.forEach((skip, idx) => {
                console.log(`  ${idx + 1}. ${skip.candidate.tableNumbers?.join(", ")} - ${skip.reason}`);
            });
        }

    } catch (error) {
        console.error("\n❌ Error:", error);
        if (error instanceof Error) {
            console.error("   Message:", error.message);
            console.error("   Stack:", error.stack);
        }
    }
}

testCombinationPlanner().catch(console.error);
