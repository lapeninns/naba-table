import { notFound } from "next/navigation";

import { ReservationWizardClient } from "@/components/features/booking/wizard/ReservationWizardClient";
import { GuestSection } from "@/components/guest/ui";
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 py-8 sm:py-10">
      <div className="guest-page guest-sections">
        <GuestSection
          title={`Book ${restaurant.name}`}
          description="Pick a time, confirm instantly, and get a shareable receipt."
          padding="md"
        >
          <ReservationWizardClient restaurant={restaurant} />
        </GuestSection>
      </div>
    </div>
  );
}

