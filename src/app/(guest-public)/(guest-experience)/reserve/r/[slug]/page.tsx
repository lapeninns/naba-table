import { ReservationWizardClient } from "../../_components/ReservationWizardClient";

import type { Metadata } from "next";


export const dynamic = "force-dynamic";

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const safeSlug = slug?.replace(/-/g, " ").replace(/\s+/g, " ").trim() || "restaurant";
  return {
    title: `Book ${safeSlug} · SajiloReserveX`,
    description: "Reserve your table instantly with live availability and instant confirmation.",
  };
}

export default async function ReserveRestaurantPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const normalized = slug?.trim() ?? "";
  return <ReservationWizardClient restaurantSlug={normalized || null} />;
}
