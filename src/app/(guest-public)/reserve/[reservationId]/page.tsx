import type { Metadata } from "next";

import ReserveApp from "../_components/ReserveApp";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ reservationId: string }>;

const shortenId = (value: string): string => (value.length > 8 ? value.slice(0, 8) : value);

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { reservationId } = await params;
  const safeId = reservationId?.trim() || "reservation";
  return {
    title: `Reservation ${shortenId(safeId)} · SajiloReserveX`,
    description: "Review the latest status, timing, and actions for your SajiloReserveX booking.",
  };
}

export default async function ReservationDetailPage({ params }: { params: RouteParams }) {
  const { reservationId } = await params;
  const normalized = reservationId?.trim() ?? "";
  const initialPath = normalized ? `/${normalized}` : "/";
  return <ReserveApp initialPath={initialPath} />;
}
