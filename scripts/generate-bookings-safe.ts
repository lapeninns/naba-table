import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in your environment or .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const RESTAURANT_ID = process.env.RESTAURANT_ID ?? "486de541-a307-4414-b0b1-f774a0e4a9fa";
const BOOKING_DATE = process.env.BOOKING_DATE ?? "2025-12-28";
const START_HOUR = process.env.START_HOUR ?? "12";
const BOOKING_COUNT = parseInt(process.env.BOOKING_COUNT ?? "15", 10);

async function generateBookings() {
  console.log("Starting booking generation with corrected schema...");

  const { data: tables, error: tablesError } = await supabase
    .from("table_inventory")
    .select("id")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("active", true);

  if (tablesError || !tables?.length) {
    console.error("Error fetching tables:", tablesError);
    return;
  }

  const tableIds = tables.map((table) => table.id);
  console.log(`Found ${tableIds.length} active tables.`);

  for (let i = 1; i <= BOOKING_COUNT; i += 1) {
    const guestName = `Staging Guest ${i} ${Math.floor(Math.random() * 900) + 100}`;

    const startTimeDate = new Date(`${BOOKING_DATE}T${START_HOUR.padStart(2, "0")}:00:00Z`);
    startTimeDate.setMinutes(startTimeDate.getMinutes() + i * 30);

    const startAt = startTimeDate.toISOString();
    const endAtDate = new Date(startTimeDate.getTime() + 2 * 60 * 60 * 1000);
    const endAt = endAtDate.toISOString();

    const startTime = `${startTimeDate.getUTCHours().toString().padStart(2, "0")}:${startTimeDate
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`;
    const endTime = `${endAtDate.getUTCHours().toString().padStart(2, "0")}:${endAtDate
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`;

    let customerId: string;

    const { data: existingCustomer, error: findError } = await supabase
      .from("customers")
      .select("id")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("phone", `+447000000${i.toString().padStart(2, "0")}`)
      .maybeSingle();

    if (findError) {
      console.error(`Error searching customer ${i}:`, findError);
      continue;
    }

    if (existingCustomer) {
      console.log(`Using existing customer for ${guestName}`);
      customerId = existingCustomer.id;
    } else {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          restaurant_id: RESTAURANT_ID,
          full_name: guestName,
          email: `${guestName.toLowerCase().replace(/ /g, ".")}@example.com`,
          phone: `+447000000${i.toString().padStart(2, "0")}`,
        })
        .select("id")
        .single();

      if (customerError) {
        console.error(`Error creating customer ${i}:`, customerError);
        continue;
      }
      customerId = customer.id;
    }

    const tableId = tableIds[i % tableIds.length];

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        restaurant_id: RESTAURANT_ID,
        customer_id: customerId,
        customer_name: guestName,
        customer_email: `${guestName.toLowerCase().replace(/ /g, ".")}@example.com`,
        customer_phone: `+447000000${i.toString().padStart(2, "0")}`,
        booking_date: BOOKING_DATE,
        start_time: startTime,
        end_time: endTime,
        start_at: startAt,
        end_at: endAt,
        party_size: Math.floor(Math.random() * 4) + 2,
        status: "confirmed",
        source: "walk-in",
        reference: `STG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      })
      .select("id")
      .single();

    if (bookingError) {
      console.error(`Error creating booking ${i}:`, bookingError);
      continue;
    }

    const { error: assignmentError } = await supabase.from("booking_table_assignments").insert({
      booking_id: booking.id,
      table_id: tableId,
      start_at: startAt,
      end_at: endAt,
      assigned_at: new Date().toISOString(),
    });

    if (assignmentError) {
      console.error(`Error creating assignment ${i}:`, assignmentError);
    } else {
      console.log(
        `Created booking ${i} for ${guestName} at ${startTime} (Assigned to table ${tableId.substring(0, 8)})`,
      );
    }
  }

  console.log("Finished corrected booking generation.");
}

generateBookings();
