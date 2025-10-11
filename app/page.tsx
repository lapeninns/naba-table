import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { Clock3, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";

import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";
import { RestaurantBrowser } from "@/components/marketing/RestaurantBrowser";
import type { RestaurantSummary } from "@/lib/restaurants/types";
import { queryKeys } from "@/lib/query/keys";
import { listRestaurants, ListRestaurantsError } from "@/server/restaurants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a table · SajiloReserveX",
  description: "Explore partner restaurants and book your next outing in seconds.",
};

type Highlight = {
  title: string;
  description: string;
  icon: LucideIcon;
};

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

function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="grid items-center gap-[var(--sr-space-7)] md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]"
    >
      <div className="space-y-[var(--sr-space-5)]">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary/80">
          SajiloReserveX
        </p>
        <div className="space-y-[var(--sr-space-4)]">
          <h1
            id="hero-title"
            className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl"
          >
            Book unforgettable nights in just a few taps
          </h1>
          <p className="max-w-xl text-base text-muted-foreground md:text-lg">
            Discover the most loved tables across the city and confirm your reservation instantly.
            Everything syncs to your profile so group plans stay organised.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[var(--sr-space-3)]">
          <MarketingSessionActions
            size="lg"
            className="flex w-full flex-col items-stretch gap-[var(--sr-space-3)] sm:w-auto sm:flex-row [&>a]:w-full sm:[&>a]:w-auto"
          />
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            No fees. No phone calls.
          </span>
        </div>
      </div>

      <HighlightGrid />
    </section>
  );
}

function HighlightGrid() {
  return (
    <div className="grid gap-[var(--sr-space-4)] rounded-3xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-6)] shadow-[var(--sr-shadow-md)] sm:grid-cols-2">
      {HIGHLIGHTS.map(({ title, description, icon: Icon }) => (
        <div
          key={title}
          className="flex flex-col gap-[var(--sr-space-2)] rounded-2xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-5)] shadow-[var(--sr-shadow-sm)]"
        >
          <div className="flex items-center gap-[var(--sr-space-3)]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      ))}
    </div>
  );
}

type RestaurantSectionProps = {
  restaurants: RestaurantSummary[];
  hasError: boolean;
};

function RestaurantSection({ restaurants, hasError }: RestaurantSectionProps) {
  return (
    <section
      id="restaurants"
      aria-labelledby="restaurants-heading"
      className="space-y-[var(--sr-space-6)]"
    >
      <div className="space-y-[var(--sr-space-3)]">
        <h2
          id="restaurants-heading"
          className="scroll-m-28 text-3xl font-semibold text-foreground md:text-4xl"
        >
          Partner restaurants
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Browse availability below to jump straight into the reservation flow. We keep timeslots in sync so
          you never double-book.
        </p>
      </div>

      <RestaurantBrowser initialData={restaurants} initialError={hasError} />
    </section>
  );
}

export default async function HomePage() {
  let restaurants: RestaurantSummary[] = [];
  let loadError = false;

  try {
    restaurants = await listRestaurants();
  } catch (error) {
    loadError = true;
    if (error instanceof ListRestaurantsError) {
      console.error(error);
    } else {
      console.error("[home-reserve] unexpected error", error);
    }
  }

  const queryClient = new QueryClient();
  if (!loadError) {
    queryClient.setQueryData(queryKeys.restaurants.list({}), restaurants);
  }
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="relative min-h-screen bg-gradient-to-b from-background via-background/98 to-background">
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--sr-space-10)] px-[var(--sr-space-6)] pb-[var(--sr-space-10)] pt-[var(--sr-space-9)] md:gap-[var(--sr-space-11)] md:pb-[var(--sr-space-12)]"
        >
          <HeroSection />
          <RestaurantSection restaurants={restaurants} hasError={loadError} />
        </main>
      </div>
    </HydrationBoundary>
  );
}
