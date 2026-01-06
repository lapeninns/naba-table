
import { Client } from "pg";

const password = process.env.DB_PASSWORD || "BCCPLjrcJLAlDFO2";
const connectionString = `postgresql://postgres.rrpeokmfbtbrirqjprpe:${password}@aws-1-eu-west-2.pooler.supabase.com:6543/postgres`;

async function preCheck() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("🔍 Running Production Pre-Optimization Check...\n");

        // 1. Check fororphans
        const orphanChecks = [
            {
                name: "orphaned_booking_state_history",
                sql: `SELECT COUNT(*) AS count FROM public.booking_state_history bsh
                      WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = bsh.booking_id)`
            },
            {
                name: "orphaned_allocations",
                sql: `SELECT COUNT(*) AS count FROM public.allocations a
                      WHERE a.booking_id IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = a.booking_id)`
            }
        ];

        console.log("--- Orphaned Data Check ---");
        for (const check of orphanChecks) {
            const res = await client.query(check.sql);
            console.log(`${check.name}: ${res.rows[0].count} records`);
        }

        // 2. Check for existing indexes
        console.log("\n--- Existing Optimized Index Check ---");
        const indexRes = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname IN ('idx_bookings_customer_id', 'idx_bookings_active_today')
        `);
        if (indexRes.rows.length > 0) {
            console.log(`Found ${indexRes.rows.length} optimized indexes already present.`);
        } else {
            console.log("No optimized performance indexes found. Ready for creation.");
        }

        // 3. Current Bloat Stats
        console.log("\n--- Current Tables Health (Top 5) ---");
        const bloatRes = await client.query(`
            SELECT relname, n_live_tup, n_dead_tup, 
                   round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct
            FROM pg_stat_user_tables 
            WHERE schemaname = 'public' AND n_live_tup > 0
            ORDER BY dead_pct DESC NULLS LAST LIMIT 5
        `);
        console.table(bloatRes.rows);

    } catch (err) {
        console.error("❌ Pre-check failed:", err);
    } finally {
        await client.end();
    }
}

preCheck();
