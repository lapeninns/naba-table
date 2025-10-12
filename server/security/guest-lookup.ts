import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import { normalizeEmail, normalizePhone } from "@/server/customers";

type GuestLookupHashParams = {
  restaurantId: string;
  email: string;
  phone: string;
  pepper?: string | null;
};

let reportedMissingPepper = false;

function getPepper(override?: string | null): string | null {
  if (override !== undefined) {
    return override ?? null;
  }
  return env.security.guestLookupPepper;
}

export function computeGuestLookupHash(params: GuestLookupHashParams): string | null {
  const { restaurantId, email, phone, pepper } = params;
  const secret = getPepper(pepper);

  if (!secret) {
    if (!reportedMissingPepper) {
      console.warn("[guest-lookup] guest lookup pepper not configured; falling back to legacy flow.");
      reportedMissingPepper = true;
    }
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!restaurantId || !normalizedEmail || !normalizedPhone) {
    return null;
  }

  const payload = `${restaurantId}|${normalizedEmail}|${normalizedPhone}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}
