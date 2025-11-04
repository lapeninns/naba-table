/**
 * Auto-Assign Loop Runner
 *
 * Continuously runs `scripts/ops-auto-assign-ultra-fast.ts` until all target
 * bookings are assigned to tables for the given restaurant + date.
 *
 * Key properties
 * - Remote-only: validates Supabase URL is remote (no local instances)
 * - Iterative: runs the ultra-fast script, then checks remaining unassigned
 * - Adaptive: adjusts feature flags based on failure patterns and performance
 * - Logging: iteration, assigned this pass, remaining, and errors summary
 * - Stuck detection: surfaces persistent failures with suggested fixes
 *
 * Usage (defaults shown):
 *   pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-ultra-fast-loop.ts \
 *     --slug prince-of-wales-pub-bromham \
 *     --date 2025-11-10
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Client as PgClient } from 'pg';

// Load env early
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

// Types
type FailureSummary = Record<string, number>;

type ReportJson = {
  executedAt: string;
  restaurant: string;
  date: string;
  totalBookings: number;
  pendingProcessed: number;
  successful: number;
  failed: number;
  successRate: number;
  totalDurationSeconds: number;
  avgProcessingMs: number;
  results: Array<{ success: boolean; reason?: string | null }>;
};

// CLI args
function getArg(flag: string, fallback: string | undefined = undefined): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const TARGET_RESTAURANT_SLUG = getArg('--slug', 'prince-of-wales-pub-bromham')!;
const TARGET_DATE = getArg('--date', '2025-11-10')!;

// Remote-only guard
function assertRemoteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!url || !/supabase\.co/.test(url)) {
    throw new Error(
      `Supabase URL does not look remote. Found: ${url || '<empty>'}. Ensure NEXT_PUBLIC_SUPABASE_URL points to remote.`,
    );
  }

  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
  if (!dbUrl || !/supabase\.co/.test(dbUrl)) {
    throw new Error(
      `DB URL does not look remote. Found: ${dbUrl || '<empty>'}. Ensure SUPABASE_DB_URL points to remote.`,
    );
  }
}

// DB helpers (remote, via pg + SUPABASE_DB_URL)
async function withPg<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL (or DATABASE_URL) is required');
  const client = new PgClient({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function getRestaurantId(slug: string): Promise<string> {
  return withPg(async (pg) => {
    const res = await pg.query('select id from restaurants where slug = $1 limit 1', [slug]);
    if (!res.rows[0]?.id) throw new Error(`Restaurant not found for slug=${slug}`);
    return res.rows[0].id as string;
  });
}

async function getUnassignedBookingIds(restaurantId: string, bookingDate: string): Promise<string[]> {
  return withPg(async (pg) => {
    const sql = `
      with base as (
        select b.id
        from bookings b
        where b.restaurant_id = $1
          and b.booking_date = $2
          and b.status in ('pending')
      )
      select b.id
      from base b
      where not exists (
        select 1 from booking_table_assignments a where a.booking_id = b.id
      );
    `;
    const res = await pg.query(sql, [restaurantId, bookingDate]);
    return res.rows.map((r) => r.id as string);
  });
}

async function rescheduleOverrunLunchBookings(restaurantId: string, bookingDate: string): Promise<number> {
  // Move bookings that cross lunch end (15:00) to dinner start (17:00), preserving duration
  return withPg(async (pg) => {
    const sql = `
      with lunch as (
        select id, start_time, end_time
        from bookings
        where restaurant_id = $1
          and booking_date = $2
          and status = 'pending'
          and start_time < time '15:00:00'
          and end_time > time '15:00:00'
      )
      update bookings b
      set 
        start_time = time '17:00:00',
        end_time = (time '17:00:00' + (l.end_time - l.start_time))::time
      from lunch l
      where b.id = l.id
      returning b.id;
    `;
    const res = await pg.query(sql, [restaurantId, bookingDate]);
    return res.rowCount || 0;
  });
}

// Child runner: executes ultra-fast script and collects stdout for analysis
async function runUltraFastOnce(envAdjustments: Record<string, string | number | boolean> = {}): Promise<{
  stdout: string;
  stderr: string;
  code: number | null;
}> {
  return new Promise((resolve) => {
    const child = spawn(
      'pnpm',
      ['tsx', '-r', 'tsconfig-paths/register', 'scripts/ops-auto-assign-ultra-fast.ts'],
      {
        env: {
          ...process.env,
          FEATURE_AUTO_ASSIGN_ON_BOOKING: 'true',
          SUPPRESS_EMAILS: 'true',
          // Apply dynamic flags
          ...Object.fromEntries(
            Object.entries(envAdjustments).map(([k, v]) => [k, String(v)])
          ),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += String(b)));
    child.stderr.on('data', (b) => (stderr += String(b)));
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

// Parse "FAILURE BREAKDOWN" block from script stdout
function parseFailureBreakdown(log: string): FailureSummary {
  const summary: FailureSummary = {};
  const marker = '📊 FAILURE BREAKDOWN:';
  const idx = log.indexOf(marker);
  if (idx === -1) return summary;
  const block = log.slice(idx + marker.length);
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const m = line.trim().match(/^(\d+)x\s+-\s+(.+)$/);
    if (m) {
      const count = Number(m[1]);
      const reason = m[2].trim();
      if (Number.isFinite(count) && reason) {
        summary[reason] = (summary[reason] || 0) + count;
      }
    } else if (line.trim() === '') {
      // Stop once the listed block ends (hit first blank after entries)
      break;
    }
  }
  return summary;
}

// Find latest JSON report produced by ultra-fast script
async function getLatestReportForDate(date: string): Promise<ReportJson | null> {
  const dir = path.join(process.cwd(), 'reports');
  try {
    const files = await fs.readdir(dir);
    const candidates = files
      .filter((f) => f.startsWith(`auto-assign-ultra-fast-${date}-`) && f.endsWith('.json'))
      .map((f) => path.join(dir, f));
    if (candidates.length === 0) return null;
    const withStats = await Promise.all(
      candidates.map(async (f) => ({
        file: f,
        mtime: (await fs.stat(f)).mtimeMs,
      })),
    );
    const latest = withStats.sort((a, b) => b.mtime - a.mtime)[0]?.file;
    if (!latest) return null;
    const raw = await fs.readFile(latest, 'utf-8');
    return JSON.parse(raw) as ReportJson;
  } catch {
    return null;
  }
}

// Adaptive tuning state
type TuningState = {
  loosenAdjacency?: boolean;
  enableMerges?: boolean;
  expandEnumeration?: boolean;
  enableLookahead?: boolean;
  relaxHoldStrictConflicts?: boolean;
  raiseHoldRateLimit?: boolean;
};

function buildEnvAdjustments(failures: FailureSummary, perf: { avgMs?: number } = {}, prev: TuningState = {}): {
  env: Record<string, string | number | boolean>;
  next: TuningState;
  rationale: string[];
} {
  const env: Record<string, string | number | boolean> = {};
  const next: TuningState = { ...prev };
  const notes: string[] = [];

  const totalFailures = Object.values(failures).reduce((a, b) => a + b, 0);
  const hasCapacityIssues = Object.keys(failures).some((r) => /no suitable|no\s+table|capacity|unavailable/i.test(r));
  const hasConflicts = Object.keys(failures).some((r) => /conflict|hold conflict|overlap/i.test(r));
  const hasRateLimits = Object.keys(failures).some((r) => /rate/i.test(r));
  const isSlow = typeof perf.avgMs === 'number' && perf.avgMs > 2000;

  if (totalFailures > 0 && hasCapacityIssues && !prev.loosenAdjacency) {
    // Allow non-adjacent merges by disabling strict adjacency enforcement globally.
    // Also set a high min party size if the platform overrides this flag elsewhere.
    env.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY = false;
    env.FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE = 8;
    next.loosenAdjacency = true;
    notes.push('Loosen adjacency to improve match space');
  }

  if (totalFailures > 0 && hasCapacityIssues && !prev.enableMerges) {
    env.FEATURE_ALLOCATOR_MERGES_ENABLED = true;
    env.FEATURE_ALLOCATOR_K_MAX = 4; // permit up to 4-table merges where policy allows
    next.enableMerges = true;
    notes.push('Enable merges to combine tables for larger parties');
  }

  if ((hasCapacityIssues || isSlow) && !prev.expandEnumeration) {
    env.FEATURE_SELECTOR_MAX_PLANS_PER_SLACK = 800;
    env.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS = 20000;
    env.FEATURE_SELECTOR_ENUMERATION_TIMEOUT_MS = 10000;
    next.expandEnumeration = true;
    notes.push('Expand enumeration limits/timeout for deeper search');
  }

  if (hasCapacityIssues && !prev.enableLookahead) {
    env.FEATURE_SELECTOR_LOOKAHEAD = true;
    env.FEATURE_SELECTOR_LOOKAHEAD_WINDOW_MINUTES = 90;
    env.FEATURE_SELECTOR_LOOKAHEAD_PENALTY_WEIGHT = 500;
    env.FEATURE_SELECTOR_LOOKAHEAD_BLOCK_THRESHOLD = 0;
    next.enableLookahead = true;
    notes.push('Enable lookahead to consider nearby times');
  }

  if (hasConflicts && !prev.relaxHoldStrictConflicts) {
    env.FEATURE_HOLDS_STRICT_CONFLICTS_ENABLED = false;
    next.relaxHoldStrictConflicts = true;
    notes.push('Relax strict hold conflict enforcement (client-side flags)');
  }

  if (hasRateLimits && !prev.raiseHoldRateLimit) {
    env.FEATURE_HOLDS_RATE_MAX_PER_BOOKING = 20;
    env.FEATURE_HOLDS_RATE_WINDOW_SECONDS = 30;
    next.raiseHoldRateLimit = true;
    notes.push('Increase hold rate limits');
  }

  return { env, next, rationale: notes };
}

function formatTopFailures(failures: FailureSummary, topN = 3): string {
  const entries = Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, topN);
  if (entries.length === 0) return 'none';
  return entries.map(([reason, count]) => `${count}x ${reason}`).join('; ');
}

async function main() {
  assertRemoteSupabase();

  const restaurantId = await getRestaurantId(TARGET_RESTAURANT_SLUG);
  let iteration = 0;
  let tuning: TuningState = {};
  let lastUnassigned: string[] = [];
  let stuckRounds = 0;

  // Initial state
  let unassigned = await getUnassignedBookingIds(restaurantId, TARGET_DATE);
  console.log(`Starting auto-assignment loop for ${TARGET_RESTAURANT_SLUG} @ ${TARGET_DATE}`);
  console.log(`Initial unassigned (pending) bookings: ${unassigned.length}`);

  while (unassigned.length > 0) {
    iteration += 1;
    console.log(`\n—— Iteration ${iteration} ——`);

    // Run once with current tuning env
    const { stdout, stderr, code } = await runUltraFastOnce(tuning as Record<string, string | number | boolean>);
    if (code !== 0) {
      console.error('Assignment script exited with non-zero code:', code);
      if (stderr) console.error(stderr);
    }

    // Parse output + latest report
    let failures = parseFailureBreakdown(stdout);
    const report = await getLatestReportForDate(TARGET_DATE);
    if (Object.keys(failures).length === 0 && report?.results?.length) {
      for (const r of report.results) {
        if (!r.success) {
          const key = (r.reason ?? 'Unknown').trim();
          failures[key] = (failures[key] || 0) + 1;
        }
      }
    }
    const assignedThisPass = report?.successful ?? 0;
    const avgMs = report?.avgProcessingMs;

    // Query remaining
    const remaining = await getUnassignedBookingIds(restaurantId, TARGET_DATE);

    // Iteration summary
    console.log(`Assigned this iteration: ${assignedThisPass}`);
    console.log(`Remaining unassigned: ${remaining.length}`);
    if (Object.keys(failures).length > 0) {
      console.log(`Top failure reasons: ${formatTopFailures(failures)}`);
    }
    if (typeof avgMs === 'number') {
      console.log(`Avg processing time: ${avgMs} ms`);
    }

    // Stuck detection (same set, no change)
    const sameSet = remaining.length === lastUnassigned.length && remaining.every((id, i) => id === lastUnassigned[i]);
    if (sameSet) {
      stuckRounds += 1;
    } else {
      stuckRounds = 0;
    }
    lastUnassigned = remaining.slice();

    // Adaptive adjustments for the next run
    const { env, next, rationale } = buildEnvAdjustments(failures, { avgMs }, tuning);
    if (Object.keys(env).length > 0) {
      tuning = next;
      console.log(`Adjusting algorithm for next run: ${rationale.join('; ')}`);
    }

    // Stuck handling
    if (stuckRounds >= 2) {
      // Optional: auto-reschedule service overrun bookings into dinner start
      const overrunCount = Object.entries(failures).filter(([k]) => /overrun lunch service/i.test(k)).reduce((a, [,v]) => a + (v||0), 0);
      const autoReschedule = process.env.AUTO_RESCHEDULE_OVERRUN === '1' || process.env.AUTO_RESCHEDULE_OVERRUN === 'true';
      if (autoReschedule && overrunCount > 0) {
        console.warn(`\nAttempting to auto-reschedule ${overrunCount} lunch-overrun bookings to 17:00...`);
        const moved = await rescheduleOverrunLunchBookings(restaurantId, TARGET_DATE);
        console.log(`Rescheduled ${moved} bookings. Re-running assignment...`);
        stuckRounds = 0;
        lastUnassigned = [];
        continue;
      }
      console.warn('\nThe algorithm appears stuck on the same bookings across multiple iterations.');
      console.warn('Suggestions:');
      console.warn('- Verify adjacency requirements and enable merges for larger parties');
      console.warn('- Check table status/blocks and service windows for conflicts');
      console.warn('- Try manual debug with scripts/debug-single-assignment.ts for a specific booking');
      break;
    }

    // Continue or complete
    unassigned = remaining;
    if (unassigned.length === 0) {
      break;
    }
  }

  // Final verification
  const finalRemaining = await getUnassignedBookingIds(restaurantId, TARGET_DATE);
  if (finalRemaining.length === 0) {
    console.log(`\n✅ Success: all bookings assigned for ${TARGET_DATE}.`);
    process.exit(0);
  } else {
    console.error(`\n❌ Incomplete: ${finalRemaining.length} bookings remain unassigned.`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('Fatal error in loop runner:', err?.message || err);
  process.exit(1);
});
