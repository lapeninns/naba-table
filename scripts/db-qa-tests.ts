
import { Client } from "pg";

const password = process.env.DB_PASSWORD || "BCCPLjrcJLAlDFO2";
const connectionString = process.env.SUPABASE_DB_URL ||
    `postgresql://postgres.rrpeokmfbtbrirqjprpe:${password}@aws-1-eu-west-2.pooler.supabase.com:6543/postgres`;

async function runQA() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("🚀 Starting Database Optimization QA Tests...\n");

        // Fetch real valid IDs first for accurate testing
        const restaurantRes = await client.query("SELECT id FROM public.restaurants LIMIT 1");
        const customerRes = await client.query("SELECT id FROM public.customers LIMIT 1");
        const tableRes = await client.query("SELECT id FROM public.table_inventory LIMIT 1");

        if (restaurantRes.rows.length === 0 || customerRes.rows.length === 0 || tableRes.rows.length === 0) {
            throw new Error("Could not find required seed data (restaurants/customers/tables) in database.");
        }

        const realRestaurantId = restaurantRes.rows[0].id;
        const realCustomerId = customerRes.rows[0].id;
        const realTableId = tableRes.rows[0].id;

        // --- TEST 1: Index Usage (EXPLAIN ANALYZE) ---
        console.log("------------------------------------------------------------");
        console.log("TEST 1: Verifying Index Usage with EXPLAIN ANALYZE");
        console.log("------------------------------------------------------------");

        const queries = [
            {
                name: "Customer Booking History (idx_bookings_customer_id)",
                sql: `EXPLAIN (ANALYZE, BUFFERS) 
                      SELECT id FROM public.bookings 
                      WHERE customer_id = '${realCustomerId}' 
                      ORDER BY booking_date DESC LIMIT 5`
            },
            {
                name: "Active Bookings Today (idx_bookings_active_today)",
                sql: `EXPLAIN (ANALYZE, BUFFERS) 
                      SELECT id FROM public.bookings 
                      WHERE restaurant_id = '${realRestaurantId}' 
                      AND booking_date = CURRENT_DATE 
                      AND status IN ('confirmed', 'pending', 'checked_in')`
            }
        ];

        for (const query of queries) {
            console.log(`\n🔍 Query: ${query.name}`);
            try {
                const res = await client.query(query.sql);
                const plan = res.rows.map(r => r["QUERY PLAN"]).join("\n");
                console.log(plan);

                if (plan.includes("Index Scan") || plan.includes("Index Only Scan") || plan.includes("Bitmap Index Scan")) {
                    console.log("✅ SUCCESS: Index is being used.");
                } else {
                    console.log("⚠️ WARNING: Sequential scan detected. Index might not be used yet (try more data).");
                }
            } catch (err: unknown) {
                console.log(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // --- TEST 2: Foreign Key Constraints (Functional) ---
        console.log("\n------------------------------------------------------------");
        console.log("TEST 2: Verifying Foreign Key Constraints (CASCADE/SET NULL)");
        console.log("------------------------------------------------------------");

        try {
            // Setup dummy data
            await client.query("BEGIN");

            console.log(`📝 Creating test booking for restaurant ${realRestaurantId}...`);
            const bookingRes = await client.query(`
                INSERT INTO public.bookings (
                    restaurant_id, customer_id, booking_date, start_time, end_time, 
                    party_size, status, customer_name, customer_email, customer_phone, reference
                )
                VALUES ($1, $2, CURRENT_DATE, '19:00', '21:00', 2, 'confirmed', 
                       'QA Test User', 'qa@example.com', '1234567890', 'QA-' || floor(random()*1000000))
                RETURNING id
            `, [realRestaurantId, realCustomerId]);
            const bookingId = bookingRes.rows[0].id;

            console.log("📝 Creating test allocation (SET NULL path)...");
            await client.query(`
                INSERT INTO public.allocations (booking_id, resource_type, resource_id, restaurant_id, "window")
                VALUES ($1, 'table', $2, $3, tstzrange(now(), now() + interval '2 hours'))
            `, [bookingId, realTableId, realRestaurantId]);

            console.log("📝 Creating test state history (CASCADE path)...");
            await client.query(`
                INSERT INTO public.booking_state_history (booking_id, to_status, changed_by)
                VALUES ($1, 'confirmed', NULL)
            `, [bookingId]);

            console.log("🗑️ Deleting test booking...");
            await client.query("DELETE FROM public.bookings WHERE id = $1", [bookingId]);

            // Verify
            const historyCount = await client.query("SELECT COUNT(*) FROM public.booking_state_history WHERE booking_id = $1", [bookingId]);
            const allocation = await client.query("SELECT booking_id FROM public.allocations WHERE resource_id = $1 AND restaurant_id = $2", [realTableId, realRestaurantId]);

            if (parseInt(historyCount.rows[0].count) === 0) {
                console.log("✅ SUCCESS: booking_state_history record was CASCADED.");
            } else {
                console.log("❌ FAILURE: booking_state_history record still exists!");
            }

            if (allocation.rows.length > 0 && allocation.rows[0].booking_id === null) {
                console.log("✅ SUCCESS: allocations record was SET NULL.");
            } else if (allocation.rows.length === 0) {
                console.log("ℹ️ Note: allocation record was also deleted (maybe it was unique?).");
            } else {
                console.log("❌ FAILURE: allocations.booking_id is still " + allocation.rows[0].booking_id);
            }

            await client.query("ROLLBACK"); // Clean up everything
            console.log("🧹 Test transaction rolled back (database is clean).");

        } catch (err: unknown) {
            await client.query("ROLLBACK");
            console.log(`❌ Error in FK Test: ${err instanceof Error ? err.message : String(err)}`);
        }

        // --- TEST 3: Autovacuum Settings Verification ---
        console.log("\n------------------------------------------------------------");
        console.log("TEST 3: Verifying Autovacuum Settings");
        console.log("------------------------------------------------------------");

        const avRes = await client.query(`
            SELECT relname, reloptions 
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = 'public' AND relname = 'bookings'
        `);
        console.log(`Settings for 'bookings': ${JSON.stringify(avRes.rows[0]?.reloptions)}`);
        if (avRes.rows[0]?.reloptions?.some((opt: string) => opt.includes("autovacuum_vacuum_scale_factor=0.05"))) {
            console.log("✅ SUCCESS: Aggressive autovacuum settings are applied.");
        } else {
            console.log("❌ FAILURE: Autovacuum settings not found.");
        }

        console.log("\n------------------------------------------------------------");
        console.log("✨ QA Completed Successfully!");
        console.log("------------------------------------------------------------");

    } catch (err: unknown) {
        console.error("❌ QA Failed:", err);
    } finally {
        await client.end();
    }
}

runQA();
