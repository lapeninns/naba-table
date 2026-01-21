import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FIRST_NAMES = ["James", "Sarah", "Michael", "Emma", "David", "Olivia"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"];
const SEATING = ["any", "window", "bar", "booth"];

function randEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randName(): string {
  return `${randEl(FIRST_NAMES)} ${randEl(LAST_NAMES)}`;
}

function randEmail(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, ".")}+${Date.now()}@example.com`;
}

function randPhone(): string {
  return `+447${Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, "0")}`;
}

function randId(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function getRestaurant(): Promise<string> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("No restaurants");
  return data[0].id;
}

async function getCustomer(
  rid: string,
  name: string,
  email: string,
  phone: string
): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .insert({ restaurant_id: rid, full_name: name, email, phone })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function createBooking(
  rid: string,
  cid: string,
  name: string,
  email: string,
  phone: string,
  date: string,
  start: string,
  end: string,
  party: number,
  type: "lunch" | "dinner",
  seat: string
): Promise<void> {
  const ref = `STG-${randId()}`;
  const { error } = await supabase.from("bookings").insert({
    restaurant_id: rid,
    customer_id: cid,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    booking_date: date,
    start_time: start,
    end_time: end,
    party_size: party,
    booking_type: type,
    seating_preference: seat,
    status: "confirmed",
    source: "api",
    reference: ref,
  });
  if (error) throw error;
}

async function seed() {
  try {
    const rid = await getRestaurant();
    console.log(`Restaurant: ${rid}\n`);

    const today = new Date(2026, 0, 21);
    let total = 0;

    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];
      const day = date.toLocaleDateString("en-US", { weekday: "long" });

      console.log(`${day} ${dateStr}`);

      const lunchCount = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < lunchCount; i++) {
        const min = Math.floor(Math.random() * 60)
          .toString()
          .padStart(2, "0");
        const name = randName();
        const cid = await getCustomer(rid, name, randEmail(name), randPhone());
        try {
          await createBooking(
            rid,
            cid,
            name,
            randEmail(name),
            randPhone(),
            dateStr,
            `12:${min}:00`,
            `14:${min}:00`,
            2 + Math.floor(Math.random() * 5),
            "lunch",
            randEl(SEATING)
          );
          total++;
          console.log(`  ✓ Lunch 12:${min}`);
        } catch {
          console.log(`  ✗ Lunch 12:${min}`);
        }
      }

      const dinnerCount = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < dinnerCount; i++) {
        const min = Math.floor(Math.random() * 60)
          .toString()
          .padStart(2, "0");
        const h = 18 + Math.floor(Math.random() * 2);
        const eh = (h + 2) % 24;
        const name = randName();
        const cid = await getCustomer(rid, name, randEmail(name), randPhone());
        try {
          await createBooking(
            rid,
            cid,
            name,
            randEmail(name),
            randPhone(),
            dateStr,
            `${h.toString().padStart(2, "0")}:${min}:00`,
            `${eh.toString().padStart(2, "0")}:${min}:00`,
            2 + Math.floor(Math.random() * 5),
            "dinner",
            randEl(SEATING)
          );
          total++;
          console.log(`  ✓ Dinner ${h.toString().padStart(2, "0")}:${min}`);
        } catch {
          console.log(`  ✗ Dinner ${h.toString().padStart(2, "0")}:${min}`);
        }
      }

      console.log("");
    }

    console.log(`\n✅ Created ${total} bookings for this week`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

seed();
