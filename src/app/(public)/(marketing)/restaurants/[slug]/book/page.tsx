import { notFound } from "next/navigation";

import { ReservationWizardClient } from "@/components/features/booking/wizard/ReservationWizardClient";
import { getRestaurantBySlug } from "@/server/restaurants/getRestaurantBySlug";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const safeSlug = slug?.replace(/-/g, " ").replace(/\s+/g, " ").trim() || "restaurant";
  return {
    title: `Book ${safeSlug} · Nab a Table`,
    description: "Reserve your table instantly with live availability and instant confirmation.",
  };
}

export default async function BookingPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const normalized = slug?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return notFound();
  }

  const restaurant = await getRestaurantBySlug(normalized);
  if (!restaurant) {
    return notFound();
  }

  // Render the wizard directly without extra wrapper cards
  return <ReservationWizardClient restaurant={restaurant} />;
}
