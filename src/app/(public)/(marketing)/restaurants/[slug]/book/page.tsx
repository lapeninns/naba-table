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

  return (
    <main className="guest-theme bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl rounded-[var(--guest-radius-2xl)] border border-slate-100 bg-white p-4 sm:p-5 shadow-[var(--guest-shadow-xl)]">
        <ReservationWizardClient restaurant={restaurant} />
      </div>
    </main>
  );
}
