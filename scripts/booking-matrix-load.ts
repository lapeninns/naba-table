/**
 * Booking Matrix Load Runner
 * - Fetches real schedule windows per day from /api/restaurants/:slug/schedule
 * - Iterates all feasible time slots and party sizes (1..12)
 * - Optionally checks /api/availability before attempting booking
 * - Creates up to N bookings across a date range to exercise table assignment
 *
 * Usage examples:
 *  pnpm tsx scripts/booking-matrix-load.ts --count 1000 --days 7
 *  pnpm tsx scripts/booking-matrix-load.ts --days 3 --maxParty 12 --slug old-crown-pub-girton
 *  BASE_URL=http://localhost:3000 pnpm tsx scripts/booking-matrix-load.ts --count 200
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

type Json = Record<string, unknown>;

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

type Args = {
  slug?: string;
  restaurantId?: string;
  days: number; // number of days from today
  count: number; // target bookings to attempt
  maxParty: number; // party max (<= 12)
  concurrency: number; // parallelism
  availabilityCheck: boolean; // call /api/availability first
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const idx = argv.findIndex((t) => t === `--${name}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);
  return {
    slug: get('slug'),
    restaurantId: get('restaurantId'),
    days: Number(get('days') ?? 7),
    count: Number(get('count') ?? 1000),
    maxParty: Math.min(12, Number(get('maxParty') ?? 12)),
    concurrency: Number(get('concurrency') ?? 4),
    availabilityCheck: has('noAvailabilityCheck') ? false : true,
  };
}

function isoDate(addDays = 0, tz = 'UTC'): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + addDays);
  // Format YYYY-MM-DD in tz-insensitive way; server expects a date string
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

async function getSchedule(slug: string, date: string): Promise<{
  restaurantId: string;
  timezone: string;
  slots: Array<{ value: string; disabled: boolean; bookingOption: string }>;
}> {
  return await fetchJSON(`${BASE_URL}/api/restaurants/${encodeURIComponent(slug)}/schedule?date=${date}`);
}

async function checkAvailability(args: {
  restaurantId: string;
  date: string;
  time: string;
  party: number;
}): Promise<boolean> {
  const url = `${BASE_URL}/api/availability?restaurantId=${encodeURIComponent(args.restaurantId)}&date=${args.date}&time=${args.time}&partySize=${args.party}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.status === 429) {
      // Rate-limited: wait a little and allow caller to retry by returning false
      const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
      await new Promise((r) => setTimeout(r, Math.min(5, retryAfter) * 1000));
      return false;
    }
    if (!res.ok) return false;
    const payload = (await res.json()) as { available?: boolean };
    return !!payload.available;
  } catch {
    return false;
  }
}

type BookingResult = {
  ok: boolean;
  status: number;
  date: string;
  time: string;
  party: number;
  bookingType: string;
  seating: string;
  id?: string;
  bookingStatus?: string;
  message?: string;
};

async function createBooking(args: {
  restaurantId: string;
  date: string;
  time: string;
  party: number;
  bookingType: string;
  seating: 'any' | 'indoor' | 'outdoor';
  index: number;
}): Promise<BookingResult> {
  const idempotencyKey = crypto.randomUUID();
  const email = `matrix+${Date.now()}_${args.index}@example.com`;
  const name = `Matrix Runner ${args.index}`;
  const suffix = Math.abs(Number(BigInt.asUintN(32, BigInt(crypto.randomInt(1, 2 ** 31))) + BigInt(args.index)))
    .toString()
    .slice(-7);
  const phone = `07${suffix}`; // UK-like mobile; randomized for uniqueness
  const payload = {
    restaurantId: args.restaurantId,
    date: args.date,
    time: args.time,
    party: args.party,
    bookingType: args.bookingType,
    seating: args.seating,
    name,
    email,
    phone,
    marketingOptIn: false,
  } satisfies Record<string, unknown>;

  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const status = res.status;
  const ok = res.ok;
  if (!ok) {
    let message: string | undefined;
    try {
      const data = (await res.json()) as Json & { error?: string };
      message = data?.error ?? JSON.stringify(data);
    } catch {
      message = await res.text();
    }
    return { ok, status, date: args.date, time: args.time, party: args.party, bookingType: args.bookingType, seating: args.seating, message };
  }

  try {
    const json = (await res.json()) as { booking?: { id?: string; status?: string } };
    return { ok, status, date: args.date, time: args.time, party: args.party, bookingType: args.bookingType, seating: args.seating, id: json.booking?.id, bookingStatus: json.booking?.status };
  } catch {
    return { ok, status, date: args.date, time: args.time, party: args.party, bookingType: args.bookingType, seating: args.seating };
  }
}

async function throttleAll<T>(limit: number, items: Array<() => Promise<T>>): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let active = 0;
  return await new Promise((resolve) => {
    const pump = () => {
      if (index >= items.length && active === 0) return resolve(results);
      while (active < limit && index < items.length) {
        const i = index++;
        active++;
        items[i]().then((r) => results.push(r)).catch((e) => results.push(e)).finally(() => {
          active--;
          pump();
        });
      }
    };
    pump();
  });
}

async function main() {
  const args = parseArgs();
  const startedAt = new Date();
  console.log(`[matrix] Base URL: ${BASE_URL}`);
  console.log(`[matrix] Target days=${args.days}, count=${args.count}, maxParty=${args.maxParty}, concurrency=${args.concurrency}, availabilityCheck=${args.availabilityCheck}`);

  const restaurants = await getRestaurants();
  if (restaurants.length === 0) {
    console.error('[matrix] No restaurants returned by /api/restaurants');
    process.exit(1);
  }

  let slug = args.slug;
  let restaurantId = args.restaurantId;
  if (!slug || !restaurantId) {
    const pick = restaurants[0];
    slug ||= pick.slug;
    restaurantId ||= pick.id;
  }
  if (!slug || !restaurantId) {
    console.error('[matrix] Unable to resolve restaurant slug/id');
    process.exit(1);
  }

  // Build candidate combinations
  const combos: Array<{ date: string; time: string; bookingType: string } & { party: number }> = [];
  for (let d = 0; d < args.days; d++) {
    const date = isoDate(d);
    const sched = await getSchedule(slug, date);
    const slots = (sched.slots ?? []).filter((s) => !s.disabled);
    for (const slot of slots) {
      const bookingType = slot.bookingOption ?? 'dinner';
      for (let party = 1; party <= args.maxParty; party++) {
        combos.push({ date, time: slot.value, bookingType, party });
      }
    }
  }

  console.log(`[matrix] Built ${combos.length} candidate combinations`);
  if (combos.length === 0) {
    console.error('[matrix] No candidate combinations found from schedule');
    process.exit(1);
  }

  // Shuffle to spread across days/times
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }

  const target = Math.min(args.count, combos.length);
  const tasks: Array<() => Promise<BookingResult>> = [];
  let index = 0;
  for (const c of combos.slice(0, target)) {
    const i = index++;
    tasks.push(async () => {
      if (args.availabilityCheck) {
        const ok = await checkAvailability({ restaurantId, date: c.date, time: c.time, party: c.party });
        if (!ok) {
          return { ok: false, status: 409, date: c.date, time: c.time, party: c.party, bookingType: c.bookingType, seating: 'any', message: 'unavailable' };
        }
      }
      // Alternate seating between any/indoor/outdoor for variability
      const seating: 'any' | 'indoor' | 'outdoor' = i % 3 === 0 ? 'any' : i % 3 === 1 ? 'indoor' : 'outdoor';
      return await createBooking({ restaurantId, date: c.date, time: c.time, party: c.party, bookingType: c.bookingType, seating, index: i });
    });
  }

  const results = await throttleAll(args.concurrency, tasks);
  const okCount = results.filter((r) => r.ok).length;
  const byStatus = results.reduce<Record<number, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const byBookingStatus = results.reduce<Record<string, number>>((acc, r) => {
    const key = r.bookingStatus ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`[matrix] Completed: ${results.length} attempts, success=${okCount}`);
  console.log(`[matrix] Status breakdown:`, byStatus);

  const outDir = path.resolve('reports');
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `booking-matrix-${stamp}.json`);
  await fs.writeFile(
    outPath,
    JSON.stringify(
      { args, baseURL: BASE_URL, restaurantId, slug, startedAt, finishedAt: new Date(), byStatus, byBookingStatus, results },
      null,
      2,
    ),
  );
  console.log(`[matrix] Wrote report: ${outPath}`);
}

main().catch((err) => {
  console.error('[matrix] Fatal error:', err);
  process.exit(1);
});
