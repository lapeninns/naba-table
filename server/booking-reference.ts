import { randomInt } from "node:crypto";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";


const BOOKING_REFERENCE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateBookingReference(length = 10): string {
  const chars = BOOKING_REFERENCE_ALPHABET;
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += chars[randomInt(chars.length)];
  }
  return output;
}

export async function generateUniqueBookingReference(
  client: SupabaseClient<Database, any, any>,
  options: { maxAttempts?: number } = {},
): Promise<string> {
  const maxAttempts = options.maxAttempts ?? 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reference = generateBookingReference();
    const { data, error } = await client
      .from("bookings")
      .select("id")
      .eq("reference", reference)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return reference;
    }
  }

  throw new Error("Unable to generate unique booking reference");
}
