/**
 * Booking Pack & Fill Runner
 *
 * Strategy per slot (earliest to latest):
 *  1) Try "perfect fits" first: 1, 2, 4
 *  2) Then try "imperfect fits" that often require adjacent tables: 11, 5
 *  3) Repeat each party size until availability says unavailable or slot limit reached
 *  4) Expect confirmed (auto-assign). If pending, record reason via /api/availability
 *
 * Fast mode expectations:
 *  - Run with FEATURE_AUTO_ASSIGN_ON_BOOKING=true on the server
 *  - Run with LOAD_TEST_DISABLE_EMAILS=true to skip emails
 *  - Dev limiter bypassed; otherwise you may see 429
 *
 * Examples:
 *  BASE_URL=http://localhost:3000 pnpm tsx scripts/booking-pack-fill.ts --date 2025-12-25 --maxPerSlot 30
 *  pnpm tsx scripts/booking-pack-fill.ts --slug old-crown-pub-girton --sizes 1,2,4|11,5 --limit 20
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

type Args = {
  slug?: string;
  restaurantId?: string;
  date?: string; // YYYY-MM-DD
  sizes?: string; // e.g., "1,2,4|11,5"
  limit?: number; // max bookings per slot
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    slug: get('slug'),
    restaurantId: get('restaurantId'),
    date: get('date'),
    sizes: get('sizes'),
    limit: get('maxPerSlot') ? Number(get('maxPerSlot')) : (get('limit') ? Number(get('limit')) : undefined),
  };
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

async function getRestaurants(): Promise<Array<{ id: string; slug: string; name?: string }>> {
  const data = await fetchJSON<{ data: Array<{ id: string; slug: string; name?: string }> }>(
    `${BASE_URL}/api/restaurants`,
  );
  return data.data ?? [];
}

async function getSchedule(slug: string, date?: string): Promise<{
  restaurantId: string;
  timezone: string;
  slots: Array<{ value: string; disabled: boolean; bookingOption: string }>;
  window?: { opensAt: string | null };
}> {
  const url = new URL(`${BASE_URL}/api/restaurants/${encodeURIComponent(slug)}/schedule`);
  if (date) url.searchParams.set('date', date);
  return await fetchJSON(url.toString());
}

async function checkAvailability(args: {
  restaurantId: string;
  date: string;
  time: string;
  party: number;
}): Promise<{ available: boolean; reason?: string } | null> {
  const url = `${BASE_URL}/api/availability?restaurantId=${encodeURIComponent(args.restaurantId)}&date=${args.date}&time=${args.time}&partySize=${args.party}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { available?: boolean; reason?: string };
    return { available: !!json.available, reason: json.reason };
  } catch {
    return null;
  }
}

type AttemptResult = {
  id?: string;
  status: string;
  http: number;
  reason?: string;
  email?: string;
  phone?: string;
};

async function createBooking(args: {
  restaurantId: string;
  date: string;
  time: string;
  party: number;
  bookingType: string;
}): Promise<AttemptResult> {
  const idempotencyKey = crypto.randomUUID();
  const email = `pack+${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`;
  const name = `Pack Runner`;
  const phone = `07${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const payload = {
    restaurantId: args.restaurantId,
    date: args.date,
    time: args.time,
    party: args.party,
    bookingType: args.bookingType,
    seating: 'any',
    name,
    email,
    phone,
    marketingOptIn: false,
  };
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  const http = res.status;
  if (!res.ok) {
    let reason: string | undefined;
    try { const body = await res.json(); reason = body?.error; } catch {}
    return { http, status: 'error', reason };
  }
  try {
    const json = (await res.json()) as { booking?: { id?: string; status?: string } };
    return { http, id: json.booking?.id, status: json.booking?.status ?? 'unknown', email, phone };
  } catch {
    return { http, status: 'unknown', email, phone };
  }
}

async function pollBookingStatus(args: { email: string; phone: string; bookingId?: string }, timeoutMs = 5000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const url = `${BASE_URL}/api/bookings?email=${encodeURIComponent(args.email)}&phone=${encodeURIComponent(args.phone)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as { bookings?: Array<{ id: string; status?: string }> };
        const found = (json.bookings ?? []).find((b) => !args.bookingId || b.id === args.bookingId);
        if (found?.status) {
          if (found.status === 'confirmed') return 'confirmed';
          // keep waiting if still pending
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

function parseSizesSpec(spec?: string): number[][] {
  // "1,2,4|11,5" -> [[1,2,4],[11,5]] phases
  if (!spec) return [[1, 2, 4], [11, 5]];
  return spec.split('|').map((group) =>
    group.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0),
  ).filter((g) => g.length > 0);
}

async function main() {
  const args = parseArgs();
  const sizesPhases = parseSizesSpec(args.sizes); // phases of party sizes
  const perSlotLimit = Math.max(1, Math.min(args.limit ?? 50, 200));

  const restaurants = await getRestaurants();
  if (restaurants.length === 0) throw new Error('No restaurants');
  let slug = args.slug ?? restaurants[0].slug;
  let restaurantId = args.restaurantId ?? restaurants[0].id;

  const schedule = await getSchedule(slug, args.date);
  const date = args.date ?? undefined;
  const slots = (schedule.slots ?? []).filter((s) => !s.disabled).sort((a, b) => a.value.localeCompare(b.value));

  const summary: Record<string, { confirmed: number; pending: number; reasons: Record<string, number>; attempts: number }> = {};
  console.log(`[pack] ${slotLabel(schedule.window?.opensAt)} slots=${slots.length} date=${args.date ?? 'default'}`);

  for (const slot of slots) {
    const key = `${args.date ?? '<today>'} ${slot.value}`;
    summary[key] = { confirmed: 0, pending: 0, reasons: {}, attempts: 0 };

    let totalForSlot = 0;
    for (const phase of sizesPhases) {
      for (const party of phase) {
        while (totalForSlot < perSlotLimit) {
          const avail = await checkAvailability({ restaurantId, date: args.date ?? (await inferToday()), time: slot.value, party });
          if (avail && avail.available === false) {
            // No more capacity for this party size
            break;
          }
          let result: AttemptResult;
          try {
            result = await createBooking({ restaurantId, date: args.date ?? (await inferToday()), time: slot.value, party, bookingType: slot.bookingOption || 'dinner' });
          } catch (e) {
            result = { http: 0, status: 'error', reason: e instanceof Error ? e.message : String(e) };
          }
          summary[key].attempts += 1;
          totalForSlot += 1;
          if (result.status !== 'confirmed' && result.email && result.phone) {
            const polled = await pollBookingStatus({ email: result.email, phone: result.phone, bookingId: result.id }, 5000);
            if (polled === 'confirmed') {
              result.status = 'confirmed';
            }
          }
          if (result.status === 'confirmed') {
            summary[key].confirmed += 1;
          } else {
            summary[key].pending += 1;
            const reason = avail?.reason || 'UNKNOWN';
            summary[key].reasons[reason] = (summary[key].reasons[reason] ?? 0) + 1;
          }
          // Heuristic: if we see two consecutive pendings for a party size, stop for this party
          if (summary[key].pending > 0 && (avail?.available === false)) break;
          // Small pacing to let auto-assign pick up quickly
          await sleep(50);
        }
      }
    }
  }

  const outDir = path.resolve('reports');
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `booking-pack-${args.date ?? 'today'}-${stamp}.json`);
  await fs.writeFile(outPath, JSON.stringify({ baseURL: BASE_URL, slug, restaurantId, date: args.date, sizesPhases, perSlotLimit, summary }, null, 2));
  console.log(`[pack] Wrote report: ${outPath}`);
}

function slotLabel(open?: string | null) {
  return open ? `opens @ ${open}` : 'no-open';
}

async function inferToday(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

main().catch((err) => {
  console.error('[pack] Fatal:', err);
  process.exit(1);
});
