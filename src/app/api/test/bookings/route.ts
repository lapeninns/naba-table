import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { normalizePhone } from '@/server/customers';
import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getDefaultRestaurantId, getServiceSupabaseClient, getTenantServiceSupabaseClient } from '@/server/supabase';

import type { TablesInsert } from '@/types/supabase';
import type { NextRequest} from 'next/server';

export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  email: z.string().email().default('qa.seated@example.com'),
  name: z.string().default('QA Seated Guest'),
  phone: z.string().min(7).default('07123 456789'),
  partySize: z.number().int().min(1).max(12).default(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(200).optional(),
  status: z.enum(['pending', 'pending_allocation', 'confirmed', 'cancelled']).optional(),
  restaurantId: z.string().uuid().optional(),
  restaurantSlug: z.string().min(3).max(128).optional(),
});

const FALLBACK_RESTAURANT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG ?? 'white-horse-pub-waterbeach';

type RestaurantSeedOptions = {
  slug?: string | null;
  name?: string | null;
};

const normalizeSlug = (value?: string | null) => value?.trim().toLowerCase() ?? null;

function fallbackSlugFor(restaurantId: string) {
  const suffix = restaurantId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
  return `${FALLBACK_RESTAURANT_SLUG}-${suffix || 'playwright'}`;
}

async function ensureRestaurantExists(restaurantId: string, options?: RestaurantSeedOptions) {
  const service = getServiceSupabaseClient();
  const existing = await service.from('restaurants').select('id').eq('id', restaurantId).maybeSingle();
  if (existing.data) {
    return;
  }

  const slug = normalizeSlug(options?.slug) ?? fallbackSlugFor(restaurantId);
  const name = options?.name ?? 'Playwright Demo Restaurant';

  const payload = {
    id: restaurantId,
    slug,
    name,
    timezone: 'Europe/London',
    is_active: true,
    capacity: 180,
    reservation_default_duration_minutes: 90,
    reservation_interval_minutes: 15,
    reservation_last_seating_buffer_minutes: 90,
    contact_email: 'qa@example.com',
    contact_phone: '07123 456789',
    address: 'Playwright Street, QA City',
  } as const;

  const { error } = await service.from('restaurants').upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message);
  }
}

async function resolveRestaurantId(
  preferredId?: string | null,
  preferredSlug?: string | null,
): Promise<string> {
  if (preferredId) {
    await ensureRestaurantExists(preferredId, { slug: preferredSlug ?? undefined });
    return preferredId;
  }

  const normalizedSlug = normalizeSlug(preferredSlug);
  if (normalizedSlug) {
    const service = getServiceSupabaseClient();
    const existingBySlug = await service
      .from('restaurants')
      .select('id')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (!existingBySlug.error && existingBySlug.data?.id) {
      return existingBySlug.data.id;
    }
  }

  const fallbackRestaurantId = await getDefaultRestaurantId();
  await ensureRestaurantExists(fallbackRestaurantId);
  return fallbackRestaurantId;
}

function addMinutesUtc(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatIsoUtc(date: Date): string {
  return date.toISOString();
}

export async function POST(req: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const parsed = payloadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, phone, partySize, date, time, notes, status, restaurantId: requestedRestaurantId, restaurantSlug } = parsed.data;

  const service = getServiceSupabaseClient();
  let restaurantId: string;
  try {
    restaurantId = await resolveRestaurantId(requestedRestaurantId, restaurantSlug);
  } catch (error) {
    console.error('[test/bookings] failed to resolve restaurant', error);
    return NextResponse.json({ error: 'Failed to resolve restaurant context' }, { status: 500 });
  }
  const tenant = getTenantServiceSupabaseClient(restaurantId);

  const now = new Date();
  const reservationDate = date ? new Date(`${date}T00:00:00Z`) : addMinutesUtc(now, 60 * 24);
  const isoDate = reservationDate.toISOString().slice(0, 10);

  const [hours = 19, minutes = 0] = (time ?? '19:00').split(':').map((value) => Number.parseInt(value, 10));

  const startAt = new Date(Date.UTC(
    reservationDate.getUTCFullYear(),
    reservationDate.getUTCMonth(),
    reservationDate.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  ));

  const endAt = addMinutesUtc(startAt, 90);

  const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const endTime = `${endAt.getUTCHours().toString().padStart(2, '0')}:${endAt.getUTCMinutes().toString().padStart(2, '0')}`;

  const normalizedEmail = email.toLowerCase();
  const normalizedPhone = normalizePhone(phone);

  const existingCustomer = await tenant
    .from('customers')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingCustomer.error) {
    return NextResponse.json({ error: existingCustomer.error.message }, { status: 500 });
  }

  let customerId = existingCustomer.data?.id ?? null;

  if (!customerId && normalizedPhone) {
    const existingByPhone = await tenant
      .from('customers')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('phone_normalized', normalizedPhone)
      .maybeSingle();

    if (existingByPhone.error && existingByPhone.error.code !== 'PGRST116') {
      return NextResponse.json({ error: existingByPhone.error.message }, { status: 500 });
    }

    customerId = existingByPhone.data?.id ?? null;
  }

  if (!customerId) {
    const createdCustomer = await tenant
      .from('customers')
      .insert({
        restaurant_id: restaurantId,
        email: normalizedEmail,
        phone,
        full_name: name,
        marketing_opt_in: false,
      })
      .select('id')
      .single();

    if (createdCustomer.error || !createdCustomer.data) {
      return NextResponse.json({ error: createdCustomer.error?.message ?? 'Failed to create customer' }, { status: 500 });
    }

    customerId = createdCustomer.data.id;
  }

  const { data: referenceRpc } = await service.rpc('generate_booking_reference');
  const bookingInsert: TablesInsert<'bookings'> = {
    restaurant_id: restaurantId,
    customer_id: customerId,
    booking_date: isoDate,
    start_time: startTime,
    end_time: endTime,
    start_at: formatIsoUtc(startAt),
    end_at: formatIsoUtc(endAt),
    party_size: partySize,
    booking_type: 'dinner',
    seating_preference: 'any',
    status: status ?? 'confirmed',
    customer_name: name,
    customer_email: normalizedEmail,
    customer_phone: phone,
    notes: notes ?? 'Seeded via Playwright test',
    reference: referenceRpc ?? `TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    source: 'playwright.test',
    loyalty_points_awarded: 0,
    client_request_id: randomUUID(),
    details: {
      seeded_via: 'playwright.test',
    },
  };

  const insertedBooking = await tenant
    .from('bookings')
    .insert(bookingInsert)
    .select('id, reference, start_at, end_at, status')
    .single();

  if (insertedBooking.error || !insertedBooking.data) {
    return NextResponse.json({ error: insertedBooking.error?.message ?? 'Failed to create booking' }, { status: 500 });
  }

  return NextResponse.json({
    bookingId: insertedBooking.data.id,
    reference: insertedBooking.data.reference,
    status: insertedBooking.data.status,
    startAt: insertedBooking.data.start_at,
    endAt: insertedBooking.data.end_at,
  });
}
