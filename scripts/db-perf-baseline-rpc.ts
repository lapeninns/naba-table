/**
 * Database Performance Baseline via Supabase RPC
 * Uses service role key to run diagnostic queries via RPC
 * 
 * Run with: npx tsx scripts/db-perf-baseline-rpc.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL. Set it before running this script.");
    process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Set it before running this script.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

interface QueryResult {
    name: string;
    data: unknown[];
    error?: string;
}

// Queries that can run via RPC (need to create these functions)
const directQueries = [
    {
        name: "table_sizes",
        sql: `
      SELECT 
        tablename,
        n_live_tup AS estimated_row_count,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || quote_ident(tablename))) AS total_size,
        pg_total_relation_size(schemaname || '.' || quote_ident(tablename)) AS total_size_bytes
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || quote_ident(tablename)) DESC
      LIMIT 30
    `
    },
    {
        name: "cache_hit_ratio",
        sql: `
      SELECT 
        round(100.0 * sum(heap_blks_hit) / 
          NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_ratio
      FROM pg_statio_user_tables
    `
    },
    {
        name: "sequential_scans",
        sql: `
      SELECT 
        relname AS tablename,
        seq_scan,
        idx_scan,
        n_live_tup AS estimated_rows,
        CASE 
          WHEN seq_scan + COALESCE(idx_scan, 0) > 0 
          THEN round(100.0 * seq_scan / (seq_scan + COALESCE(idx_scan, 0)), 2)
          ELSE 0 
        END AS seq_scan_pct
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND (seq_scan > 0 OR idx_scan > 0)
      ORDER BY seq_scan DESC
      LIMIT 20
    `
    },
    {
        name: "table_bloat",
        sql: `
      SELECT 
        relname AS tablename,
        n_dead_tup AS dead_tuples,
        n_live_tup AS live_tuples,
        round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct,
        last_autovacuum,
        autovacuum_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `
    },
    {
        name: "index_usage",
        sql: `
      SELECT 
        sui.relname AS tablename,
        sui.indexrelname AS indexname,
        sui.idx_scan AS index_scans,
        pg_size_pretty(pg_relation_size(sui.indexrelid)) AS size
      FROM pg_stat_user_indexes sui
      WHERE sui.schemaname = 'public'
      ORDER BY sui.idx_scan DESC
      LIMIT 30
    `
    },
    {
        name: "unused_indexes",
        sql: `
      SELECT 
        sui.relname AS tablename,
        sui.indexrelname AS indexname,
        pg_size_pretty(pg_relation_size(sui.indexrelid)) AS size
      FROM pg_stat_user_indexes sui
      JOIN pg_indexes pi 
        ON sui.indexrelname = pi.indexname 
        AND sui.schemaname = pi.schemaname
      WHERE sui.schemaname = 'public'
        AND sui.idx_scan = 0
        AND pi.indexdef NOT LIKE '%UNIQUE%'
        AND pi.indexdef NOT LIKE '%PRIMARY%'
      ORDER BY pg_relation_size(sui.indexrelid) DESC
    `
    },
    {
        name: "connection_stats",
        sql: `
      SELECT 
        count(*) AS total_connections,
        count(*) FILTER (WHERE state = 'active') AS active,
        count(*) FILTER (WHERE state = 'idle') AS idle,
        count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
    `
    },
    {
        name: "database_summary",
        sql: `
      SELECT 
        pg_database.datname AS database,
        pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
        numbackends AS active_connections,
        round(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) AS cache_hit_pct,
        xact_commit AS commits,
        xact_rollback AS rollbacks,
        deadlocks
      FROM pg_stat_database
      JOIN pg_database ON pg_database.datname = pg_stat_database.datname
      WHERE pg_database.datname = current_database()
    `
    },
    {
        name: "top_slow_queries",
        sql: `
      SELECT 
        left(query, 300) AS query_preview,
        calls,
        round(total_exec_time::numeric, 2) AS total_time_ms,
        round(mean_exec_time::numeric, 2) AS avg_time_ms,
        round(max_exec_time::numeric, 2) AS max_time_ms,
        rows
      FROM extensions.pg_stat_statements
      WHERE query NOT LIKE 'COMMIT%'
        AND query NOT LIKE 'BEGIN%'
        AND query NOT LIKE 'SET %'
        AND query NOT LIKE '--%'
      ORDER BY total_exec_time DESC
      LIMIT 25
    `
    },
    {
        name: "top_queries_by_avg_time",
        sql: `
      SELECT 
        left(query, 300) AS query_preview,
        calls,
        round(mean_exec_time::numeric, 2) AS avg_time_ms,
        round(max_exec_time::numeric, 2) AS max_time_ms,
        rows
      FROM extensions.pg_stat_statements
      WHERE calls >= 10
        AND query NOT LIKE 'COMMIT%'
        AND query NOT LIKE 'BEGIN%'
        AND query NOT LIKE '--%'
      ORDER BY mean_exec_time DESC
      LIMIT 25
    `
    },
    {
        name: "postgres_version",
        sql: "SELECT version() AS postgres_version"
    },
    {
        name: "extensions",
        sql: `
      SELECT 
        extname AS extension_name, 
        extversion AS version
      FROM pg_extension
      ORDER BY extname
    `
    },
    {
        name: "rls_policies_count",
        sql: `
      SELECT 
        tablename,
        count(*) AS policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY policy_count DESC
    `
    }
];

async function runBaseline() {
    const results: QueryResult[] = [];

    console.log("✅ Connecting to Supabase:", SUPABASE_URL);
    console.log("");

    for (const query of directQueries) {
        try {
            console.log(`📊 Running: ${query.name}...`);

            // Use rpc to run arbitrary SQL (if function exists) or fall back to direct query
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: query.sql });

            if (error) {
                // The exec_sql function likely doesn't exist, let's note this
                console.log(`   ⚠️ RPC not available: ${error.message}`);
                results.push({
                    name: query.name,
                    data: [],
                    error: `RPC not available: ${error.message}`
                });
            } else {
                results.push({
                    name: query.name,
                    data: data || []
                });
                console.log(`   Found ${(data || []).length} rows`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`   ❌ Error: ${errorMessage}`);
            results.push({
                name: query.name,
                data: [],
                error: errorMessage
            });
        }
    }

    // Now let's try direct table queries that we can do via PostgREST
    console.log("\n📊 Running table-based queries...\n");

    // Get bookings count by status
    try {
        console.log("📊 Checking bookings table...");
        const { count: totalBookings } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true });

        const { data: statusCounts } = await supabase
            .from('bookings')
            .select('status')
            .limit(10000);

        const statusBreakdown = (statusCounts || []).reduce((acc: Record<string, number>, row) => {
            acc[row.status] = (acc[row.status] || 0) + 1;
            return acc;
        }, {});

        results.push({
            name: "bookings_overview",
            data: [{
                total_count: totalBookings,
                status_breakdown: statusBreakdown
            }]
        });
        console.log(`   Total bookings: ${totalBookings}`);
    } catch (err) {
        console.log(`   ❌ Error: ${err}`);
    }

    // Get customers count
    try {
        console.log("📊 Checking customers table...");
        const { count } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        results.push({
            name: "customers_overview",
            data: [{ total_count: count }]
        });
        console.log(`   Total customers: ${count}`);
    } catch (err) {
        console.log(`   ❌ Error: ${err}`);
    }

    // Get tables count
    try {
        console.log("📊 Checking table_inventory...");
        const { count } = await supabase
            .from('table_inventory')
            .select('*', { count: 'exact', head: true });

        results.push({
            name: "table_inventory_overview",
            data: [{ total_count: count }]
        });
        console.log(`   Total tables: ${count}`);
    } catch (err) {
        console.log(`   ❌ Error: ${err}`);
    }

    // Get allocations count
    try {
        console.log("📊 Checking allocations table...");
        const { count } = await supabase
            .from('allocations')
            .select('*', { count: 'exact', head: true });

        results.push({
            name: "allocations_overview",
            data: [{ total_count: count }]
        });
        console.log(`   Total allocations: ${count}`);
    } catch (err) {
        console.log(`   ❌ Error: ${err}`);
    }

    // Get restaurants
    try {
        console.log("📊 Checking restaurants...");
        const { data: restaurants } = await supabase
            .from('restaurants')
            .select('id, name, slug, is_active');

        results.push({
            name: "restaurants_list",
            data: restaurants || []
        });
        console.log(`   Restaurants: ${(restaurants || []).length}`);
    } catch (err) {
        console.log(`   ❌ Error: ${err}`);
    }

    // Save to JSON file
    const outputDir = path.join(__dirname, '../tasks/db-perf-optimization-20260106-1108/artifacts');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'baseline-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log("");
    console.log(`✅ Results saved to: ${outputPath}`);

    // Print summary
    console.log("");
    console.log("=".repeat(60));
    console.log("BASELINE SUMMARY");
    console.log("=".repeat(60));

    // Find and display key metrics
    const bookingsOverview = results.find(r => r.name === "bookings_overview");
    if (bookingsOverview?.data[0]) {
        const data = bookingsOverview.data[0] as { total_count: number; status_breakdown: Record<string, number> };
        console.log(`\nTotal Bookings: ${data.total_count}`);
        console.log("Status Breakdown:");
        Object.entries(data.status_breakdown || {}).forEach(([status, count]) => {
            console.log(`  - ${status}: ${count}`);
        });
    }

    const customersOverview = results.find(r => r.name === "customers_overview");
    if (customersOverview?.data[0]) {
        const data = customersOverview.data[0] as { total_count: number };
        console.log(`\nTotal Customers: ${data.total_count}`);
    }

    const tablesOverview = results.find(r => r.name === "table_inventory_overview");
    if (tablesOverview?.data[0]) {
        const data = tablesOverview.data[0] as { total_count: number };
        console.log(`Total Tables: ${data.total_count}`);
    }

    const allocationsOverview = results.find(r => r.name === "allocations_overview");
    if (allocationsOverview?.data[0]) {
        const data = allocationsOverview.data[0] as { total_count: number };
        console.log(`Total Allocations: ${data.total_count}`);
    }

    console.log("");
    console.log("=".repeat(60));
    console.log("Note: Full pg_stat queries require direct database connection.");
    console.log("The above metrics are from table counts via PostgREST API.");
    console.log("=".repeat(60));
}

runBaseline();
