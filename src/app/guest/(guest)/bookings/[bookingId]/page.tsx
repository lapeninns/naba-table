import OriginalPage, { generateMetadata as originalGenerateMetadata } from "../../(guest-experience)/reserve/[reservationId]/page";

type RouteParams = { bookingId: string };

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { bookingId } = params;
  return originalGenerateMetadata({ params: Promise.resolve({ reservationId: bookingId }) as any });
}

export default async function BookingDetailPage({ params }: { params: RouteParams }) {
  const { bookingId } = params;
  return OriginalPage({ params: Promise.resolve({ reservationId: bookingId }) as any });
}
