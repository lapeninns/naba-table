import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { Clock3, Sparkles, UsersRound, type LucideIcon } from "lucide-react";


import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { RestaurantBrowser } from "@/components/marketing/RestaurantBrowser";
import { queryKeys } from "@/lib/query/keys";
import { listRestaurants } from "@/server/restaurants";

import type { RestaurantFilters } from "@/lib/restaurants/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a table · SajiloReserveX",
  description:
    "Explore partner restaurants and book your next outing in seconds.",
};

// --- Configuration & Constants ---
interface Highlight {
  title: string;
  description: string;
  icon: LucideIcon;
}

const HIGHLIGHTS: Highlight[] = [
  {
    title: "Live availability",
    description: "See seats update in real time and lock in the perfect slot.",
    icon: Clock3,
  },
  {
    title: "Premium partners",
    description: "Curated venues that deliver unforgettable dining experiences.",
    icon: Sparkles,
  },
  {
    title: "Guest friendly",
    description: "Track bookings, share details, and invite friends with ease.",
    icon: UsersRound,
  },
];

// --- Sub-components ---

function HeroHeader() {
  return (
    <div className="space-y-6">
      <p className="text-primary/80 text-sm font-semibold uppercase tracking-[0.25em]">
        SajiloReserveX
      </p>
      <div className="space-y-4">
        <h1 className="text-foreground text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
          Book unforgettable nights in just a few taps
        </h1>
        <p className="text-muted-foreground max-w-xl text-base md:text-lg">
          Discover the most loved tables across the city and confirm your reservation instantly. Everything syncs to your profile so group plans stay organised.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <MarketingSessionActions
          size="lg"
          className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row [&>a]:w-full sm:[&>a]:w-auto"
        />
        <span className="text-muted-foreground text-xs uppercase tracking-[0.3em]">
          No fees. No phone calls.
        </span>
      </div>
    </div>
  );
}

function HighlightCards() {
  return (
    <div className="bg-card/50 border-border shadow-sm grid gap-4 rounded-3xl border p-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {HIGHLIGHTS.map(({ title, description, icon: Icon }) => (
        <div
          key={title}
          className="bg-card border-border shadow-xs flex flex-col gap-2 rounded-2xl border p-5"
        >
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
              {title}
            </h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      ))}
    </div>
  );
}

function HeroSection() {
  return (
    <section
      aria-label="Introduction"
      className="grid items-center gap-12 md:grid-cols-[1.2fr_0.8fr]"
    >
      <HeroHeader />
      <HighlightCards />
    </section>
  );
}

function RestaurantsSection() {
  return (
    <section
      id="restaurants"
      aria-labelledby="restaurants-heading"
      className="space-y-8"
    >
      <header className="space-y-3">
        <h2
          id="restaurants-heading"
          className="text-foreground scroll-m-28 text-3xl font-semibold md:text-4xl"
        >
          Partner restaurants
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
          Browse availability below to jump straight into the reservation flow. We keep timeslots in sync so you never double-book.
        </p>
      </header>

      {/* RestaurantBrowser will now use useQuery to pick up dehydrated state */}
      <RestaurantBrowser />
    </section>
  );
}

// --- Main Page Component ---

export default async function HomePage() {
  const queryClient = new QueryClient();

  // Prefetch data on the server.
  // We use fetchQuery with a try/catch so a data error doesn't crash the entire landing page.
  // The client component will handle the error state if hydration fails.
  try {
    await queryClient.fetchQuery({
      queryKey: queryKeys.restaurants.list({}),
      queryFn: ({ queryKey }) => {
        const filters = (queryKey[2] ?? {}) as RestaurantFilters;
        return listRestaurants(filters);
      },
    });
  } catch (error) {
    console.error("Failed to prefetch restaurants on server:", error);
    // Intentionally swallowing error here to allow Hero section to render.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="bg-background relative min-h-screen bg-gradient-to-b from-background via-background/98 to-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-12 md:gap-24 md:pb-24">
          <HeroSection />
          <RestaurantsSection />
        </div>
      </div>
    </HydrationBoundary>
  );
}
