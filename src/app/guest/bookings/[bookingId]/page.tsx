import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GuestBookingRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const normalized = bookingId?.trim();
  if (!normalized) {
    permanentRedirect("/guest/bookings");
  }
  permanentRedirect(`/bookings/${normalized}`);
}
