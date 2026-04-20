import { notFound } from "next/navigation";

import { ReservationWizardClient } from "@/components/features/booking/wizard/ReservationWizardClient";
import { getRestaurantBySlug } from "@/server/restaurants/getRestaurantBySlug";

import type { Metadata } from "next";

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
    <section className="bg-surface-warm px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-border/60 bg-background/95 p-4 shadow-sm sm:p-6">
        <ReservationWizardClient restaurant={restaurant} />
      </div>
    </section>
  );
}
