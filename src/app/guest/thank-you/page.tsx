import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Generic /guest/thank-you is deprecated.
 * Redirect to the canonical guest booking flow. Specific receipts should use
 * /guest/bookings/[id]/receipt.
 */
export default function GuestThankYouRedirect() {
  redirect("/bookings");
}
