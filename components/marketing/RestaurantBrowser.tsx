"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import config from "@/config";
import { track } from "@/lib/analytics";
import { fetchRestaurants as fetchRestaurantsApi } from "@/lib/restaurants/api";
import { useRestaurants } from "@/lib/restaurants/useRestaurants";
import { cn } from "@/lib/utils";

import type { AnalyticsEvent } from "@/lib/analytics";
import type { RestaurantFilters, RestaurantSummary } from "@/lib/restaurants/types";

type AnalyticsHandler = (event: AnalyticsEvent, props?: Record<string, unknown>) => void;

type RestaurantBrowserProps = {
  initialData?: RestaurantSummary[];
  initialError?: boolean;
  fetchRestaurants?: (filters: RestaurantFilters) => Promise<RestaurantSummary[]>;
  analytics?: AnalyticsHandler;
};

const formatCapacity = (capacity: number | null) => {
  if (capacity === null || capacity === undefined) return "Capacity not set";
  if (capacity <= 0) return "Capacity not set";
  return `${capacity} seats`;
};

export function RestaurantBrowser({
  initialData,
  initialError = false,
  fetchRestaurants,
  analytics = track,
}: RestaurantBrowserProps) {
  // Fetch all restaurants; filters removed per latest requirements.
  const fetcher = useCallback(
    (filters: RestaurantFilters) => (fetchRestaurants ?? fetchRestaurantsApi)(filters),
    [fetchRestaurants],
  );

  const { data, error, isLoading, isFetching, refetch } = useRestaurants(
    {},
    {
      queryFn: fetcher,
      initialData,
    },
  );

  const restaurants = data ?? [];
  const supportEmail = config.email?.supportEmail ?? "support@example.com";
  const resolvedInitialData = initialData ?? [];
  const isInitialLoad = isLoading && resolvedInitialData.length === 0;
  const hasInitialError = initialError && resolvedInitialData.length === 0 && restaurants.length === 0;
  const showError = Boolean(error) || hasInitialError;

  const errorTrackedRef = useRef(false);
  const emptyTrackedRef = useRef(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (hasTrackedView.current) return;
    if (restaurants.length === 0) return;
    analytics("restaurant_list_viewed", {
      timezone: null,
      minCapacity: null,
      total: restaurants.length,
    });
    hasTrackedView.current = true;
  }, [analytics, restaurants.length]);

  useEffect(() => {
    if (!showError) {
      errorTrackedRef.current = false;
      return;
    }
    if (errorTrackedRef.current) return;

    const status =
      typeof (error as { status?: number } | undefined)?.status === "number"
        ? (error as { status?: number }).status
        : undefined;

    const payload = typeof status === "number" ? { status } : undefined;
    analytics("restaurants_list_error", payload);
    toast.error("We can’t reach the restaurant list right now. Please retry.");
    errorTrackedRef.current = true;
  }, [analytics, error, showError]);

  useEffect(() => {
    if (isInitialLoad || showError) return;
    if (restaurants.length === 0 && !emptyTrackedRef.current) {
      analytics("restaurants_empty", { search: null, timezone: "all", minCapacity: null });
      emptyTrackedRef.current = true;
    }
    if (restaurants.length > 0) {
      emptyTrackedRef.current = false;
    }
  }, [analytics, isInitialLoad, restaurants.length, showError]);

  const handleRetry = useCallback(() => {
    errorTrackedRef.current = false;
    void refetch({ cancelRefetch: false, throwOnError: false });
  }, [refetch]);

  const handleRestaurantClick = (restaurant: RestaurantSummary, index: number) => {
    analytics("restaurant_selected", {
      restaurantId: restaurant.id,
      position: index,
    });
  };

  const restaurantCountText = useMemo(() => {
    const count = restaurants.length;
    if (count === 0) return "No venues live";
    if (count === 1) return "1 venue live";
    return `${count} venues live`;
  }, [restaurants.length]);

  const statusText = isFetching && !isInitialLoad ? "Refreshing live details…" : "Live data direct from partners.";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border/70 bg-white/95 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Directory</p>
            <p className="text-sm text-slate-700">A concise list of partner venues with details pulled straight from our database.</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {restaurantCountText}
          </Badge>
        </div>
        <div className="mt-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {statusText}
        </div>
      </section>

      {showError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="space-y-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-base font-semibold">We couldn’t load restaurants right now.</p>
              <p className="text-destructive/90">Retry in a moment or contact support if it keeps happening.</p>
            </div>
            <Badge variant="secondary" className="border border-destructive/50 bg-white text-destructive">
              Issue
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={handleRetry} disabled={isFetching}>
              Retry
            </Button>
            <a
              className="text-sm font-semibold underline underline-offset-4 hover:text-destructive/80"
              href={`mailto:${supportEmail}`}
            >
              Contact support
            </a>
          </div>
          {error instanceof Error ? <span className="sr-only">Error details: {error.message}</span> : null}
        </div>
      ) : null}

      <div id="restaurant-results" className="space-y-4">
        {isInitialLoad ? (
          <ul className="space-y-3" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={`skeleton-${index}`}>
                <Card className="border-border/70 bg-white/70 p-4 shadow-sm">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : restaurants.length > 0 ? (
          <ul className="space-y-3" aria-label="Partner restaurants" id="restaurants-list">
            {restaurants.map((restaurant, index) => {
              const address = restaurant.address?.trim();
              const mapUrl = restaurant.googleMapUrl?.trim();
              const bookingPolicy = restaurant.bookingPolicy?.trim();
              const contactEmail = restaurant.contactEmail?.trim();
              const contactPhone = restaurant.contactPhone?.trim();
              const interval = restaurant.reservationIntervalMinutes;
              const defaultDuration = restaurant.reservationDefaultDurationMinutes;
              const isPaused = restaurant.isActive === false;

              return (
                <li key={restaurant.id} data-testid={`restaurant-card-${restaurant.slug ?? index}`}>
                  <Card
                    role="article"
                    aria-label={restaurant.name}
                    className="group relative overflow-hidden rounded-xl border border-border/70 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold leading-tight text-foreground">{restaurant.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {restaurant.timezone}
                          </Badge>
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                            {formatCapacity(restaurant.capacity)}
                          </Badge>
                          {interval ? (
                            <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                              {interval} min slots
                            </Badge>
                          ) : null}
                          {defaultDuration ? (
                            <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                              {defaultDuration} min tables
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Badge
                        variant={isPaused ? "outline" : "secondary"}
                        className={cn(
                          "font-semibold",
                          isPaused ? "border-amber-500 text-amber-700" : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {isPaused ? "Paused" : "Live"}
                      </Badge>
                    </div>

                    <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {address ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</dt>
                          <dd className="flex flex-wrap items-center gap-2 text-slate-800">
                            <span>{address}</span>
                            {mapUrl ? (
                              <a
                                className="text-primary underline-offset-4 hover:underline"
                                href={mapUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Map
                              </a>
                            ) : null}
                          </dd>
                        </div>
                      ) : null}

                      {bookingPolicy ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Policy</dt>
                          <dd className="text-slate-800 line-clamp-2" title={bookingPolicy}>
                            {bookingPolicy}
                          </dd>
                        </div>
                      ) : null}

                      {contactEmail || contactPhone ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</dt>
                          <dd className="flex flex-wrap items-center gap-3 text-slate-800">
                            {contactPhone ? (
                              <a className="underline-offset-4 hover:underline" href={`tel:${contactPhone}`}>
                                Call {contactPhone}
                              </a>
                            ) : null}
                            {contactEmail ? (
                              <a className="underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>
                                Email
                              </a>
                            ) : null}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <a
                        href={`/reserve/r/${restaurant.slug}`}
                        className={cn(buttonVariants({ variant: "default", size: "sm" }), "touch-manipulation")}
                        onClick={() => handleRestaurantClick(restaurant, index)}
                        aria-label={`Start booking at ${restaurant.name}`}
                        data-analytics="restaurant-select"
                      >
                        Book now
                      </a>
                      {mapUrl ? (
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary underline-offset-4")}
                        >
                          Directions
                        </a>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Instant confirmation · Live availability
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-white/90 p-6 text-center shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">No restaurants available</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon or reach out to our concierge team for personalised assistance.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={handleRetry}>
                Refresh
              </Button>
              <a
                href={`mailto:${supportEmail}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "px-4")}
              >
                Contact Support
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
