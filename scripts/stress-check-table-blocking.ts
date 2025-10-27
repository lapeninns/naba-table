import { randomUUID } from "crypto";

import { DateTime } from "luxon";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env.local" });

async function main(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not defined; add it to .env.local");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const now = DateTime.utc();
    const harnessLabel = `stress-${now.toFormat("yyyyLLdd-HHmmss")}`;
    const restaurantSlug = `${harnessLabel}-${randomUUID().slice(0, 8)}`;

    const restaurantInsert = await client.query(
      `INSERT INTO public.restaurants (name, slug, timezone, capacity, contact_email, contact_phone)
       VALUES ($1, $2, 'Europe/London', 50, 'stress@example.com', '+441234567890')
       RETURNING id`,
      [harnessLabel, restaurantSlug],
    );
    const restaurantId: string = restaurantInsert.rows[0].id;

    await client.query(
      `INSERT INTO public.allowed_capacities (restaurant_id, capacity)
       VALUES ($1, 4)`,
      [restaurantId],
    );

    const zoneInsert = await client.query(
      `INSERT INTO public.zones (restaurant_id, name, sort_order)
       VALUES ($1, $2, 1)
       RETURNING id`,
      [restaurantId, `${harnessLabel}-zone`],
    );
    const zoneId: string = zoneInsert.rows[0].id;

    const tableInsert = await client.query(
      `INSERT INTO public.table_inventory (
         restaurant_id, table_number, capacity, min_party_size, max_party_size,
         section, status, position, notes, zone_id, category, seating_type, mobility, active
       )
       VALUES ($1, $2, 4, 1, 4, 'Stress Section', 'available', NULL, NULL, $3, 'dining', 'standard', 'movable', true)
       RETURNING id`,
      [restaurantId, `${harnessLabel}-T1`, zoneId],
    );
    const tableId: string = tableInsert.rows[0].id;

    const customerInsert = await client.query(
      `INSERT INTO public.customers (restaurant_id, full_name, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [restaurantId, "Stress Tester", "stress.tester@example.com", "+441234567891"],
    );
    const customerId: string = customerInsert.rows[0].id;

    const bookingStart = now.minus({ hours: 1 });
    const bookingEnd = bookingStart.plus({ hours: 1 });

    const bookingInsert = await client.query(
      `INSERT INTO public.bookings (
         restaurant_id, customer_id, booking_date, start_time, end_time, start_at, end_at,
         party_size, seating_preference, status, customer_name, customer_email, customer_phone,
         reference, source
       )
       VALUES (
         $1, $2, $3, $4::time, $5::time, $6, $7,
         2, 'any', 'confirmed', $8, $9, $10,
         $11, 'ops'
       )
       RETURNING id`,
      [
        restaurantId,
        customerId,
        bookingStart.toISODate(),
        bookingStart.toFormat("HH:mm:ss"),
        bookingEnd.toFormat("HH:mm:ss"),
        bookingStart.toISO(),
        bookingEnd.toISO(),
        "Stress Tester",
        "stress.tester@example.com",
        "+441234567891",
        `STRESS-${randomUUID().slice(0, 8)}`,
      ],
    );
    const bookingId: string = bookingInsert.rows[0].id;

    const allocationInsert = await client.query(
      `INSERT INTO public.allocations (
         booking_id, resource_type, resource_id, restaurant_id, "window", created_by, is_maintenance
       )
       VALUES ($1, 'table', $2, $3, tstzrange($4, $5, '[)'), NULL, false)
       RETURNING id`,
      [bookingId, tableId, restaurantId, bookingStart.toISO(), bookingEnd.toISO()],
    );
    const allocationId: string = allocationInsert.rows[0].id;

    const phases: Array<{
      label: string;
      start: DateTime;
      end: DateTime;
      expected: "available" | "reserved";
    }> = [
      {
        label: "active-window",
        start: now.minus({ minutes: 30 }),
        end: now.plus({ minutes: 45 }),
        expected: "reserved",
      },
      {
        label: "future-window",
        start: now.plus({ hours: 1 }),
        end: now.plus({ hours: 2 }),
        expected: "available",
      },
      {
        label: "past-window",
        start: now.minus({ hours: 2 }),
        end: now.minus({ hours: 1, minutes: 30 }),
        expected: "available",
      },
    ];

    type PhaseResult = {
      label: string;
      window: string;
      status: string;
      expected: string;
    };

    const results: PhaseResult[] = [];

    for (const phase of phases) {
      await client.query(
        `UPDATE public.allocations
         SET "window" = tstzrange($1, $2, '[)')
         WHERE id = $3`,
        [phase.start.toISO(), phase.end.toISO(), allocationId],
      );

      await client.query(`SELECT public.refresh_table_status($1)`, [tableId]);

      const statusQuery = await client.query<{ status: string }>(
        `SELECT status FROM public.table_inventory WHERE id = $1`,
        [tableId],
      );
      const status = statusQuery.rows[0]?.status ?? "unknown";
      const windowText = `[${phase.start.toISO()} -> ${phase.end.toISO()})`;
      results.push({ label: phase.label, window: windowText, status, expected: phase.expected });
    }

    console.table(results);

    const anomalies = results.filter((entry) => entry.status !== entry.expected);
    if (anomalies.length > 0) {
      console.error("⚠️  Detected table status anomalies:");
      console.table(anomalies);
    } else {
      console.log("✅ All stress phases returned expected statuses.");
    }

    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Stress test failed:", error);
  process.exitCode = 1;
});
