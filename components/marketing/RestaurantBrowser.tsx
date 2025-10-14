"use client";

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import toast from "react-hot-toast";

import config from "@/config";
import type { AnalyticsEvent } from "@/lib/analytics";
import { track } from "@/lib/analytics";
import { fetchRestaurants as fetchRestaurantsApi } from "@/lib/restaurants/api";
import type { RestaurantFilters, RestaurantSummary } from "@/lib/restaurants/types";
import { useRestaurants } from "@/lib/restaurants/useRestaurants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState<string>("all");
  const [minCapacityInput, setMinCapacityInput] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const deferredMinCapacity = useDeferredValue(minCapacityInput);

  const normalizedFilters = useMemo<RestaurantFilters>(() => {
    const search = deferredSearch.trim();
    const parsedCapacity = Number.parseInt(deferredMinCapacity, 10);
    const normalizedMinCapacity =
      Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : undefined;
    return {
      search: search.length > 0 ? search : undefined,
      timezone: timezoneFilter !== "all" ? timezoneFilter : undefined,
      minCapacity: normalizedMinCapacity,
    };
  }, [deferredMinCapacity, deferredSearch, timezoneFilter]);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        search: normalizedFilters.search ?? null,
        timezone: normalizedFilters.timezone ?? "all",
        minCapacity: normalizedFilters.minCapacity ?? null,
      }),
    [normalizedFilters],
  );

  const fetcher = useCallback(
    (filters: RestaurantFilters) => (fetchRestaurants ?? fetchRestaurantsApi)(filters),
    [fetchRestaurants],
  );

  const { data, error, isLoading, isFetching, refetch } = useRestaurants(normalizedFilters, {
    queryFn: fetcher,
    initialData,
  });

  const restaurants = data ?? [];
  const supportEmail = config.mailgun?.supportEmail ?? "support@example.com";

  const errorTrackedRef = useRef(false);
  const emptyTrackedKeyRef = useRef<string | null>(null);
  const resolvedInitialData = initialData ?? [];
  const isInitialLoad = isLoading && resolvedInitialData.length === 0;
  const isFiltering = isFetching && !isInitialLoad;

  const uniqueTimezones = useMemo(() => {
    const source = restaurants.length > 0 ? restaurants : resolvedInitialData;
    const set = new Set<string>();
    source.forEach((restaurant) => {
      if (restaurant.timezone) {
        set.add(restaurant.timezone);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [restaurants, resolvedInitialData]);

  const filteredRestaurants = useMemo(() => {
    if (restaurants.length === 0) {
      return [];
    }

    const searchLower = normalizedFilters.search?.toLowerCase() ?? "";
    return restaurants.filter((restaurant) => {
      if (searchLower && !restaurant.name.toLowerCase().includes(searchLower)) {
        return false;
      }
      if (normalizedFilters.timezone && restaurant.timezone !== normalizedFilters.timezone) {
        return false;
      }
      if (
        typeof normalizedFilters.minCapacity === "number" &&
        (restaurant.capacity ?? 0) < normalizedFilters.minCapacity
      ) {
        return false;
      }
      return true;
    });
  }, [restaurants, normalizedFilters]);

  const hasInitialError = initialError && resolvedInitialData.length === 0 && restaurants.length === 0;
  const showError = Boolean(error) || hasInitialError;

  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (hasTrackedView.current) return;
    if (restaurants.length === 0) return;
    analytics("restaurant_list_viewed", {
      timezone: normalizedFilters.timezone ?? "all",
      minCapacity: normalizedFilters.minCapacity ?? null,
      total: restaurants.length,
    });
    hasTrackedView.current = true;
  }, [analytics, restaurants.length, normalizedFilters.minCapacity, normalizedFilters.timezone, restaurants]);

  useEffect(() => {
    if (!showError) {
      errorTrackedRef.current = false;
      return;
    }
    if (errorTrackedRef.current) {
      return;
    }

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
    if (isInitialLoad || showError) {
      return;
    }

    if (filteredRestaurants.length > 0) {
      emptyTrackedKeyRef.current = null;
      return;
    }

    if (emptyTrackedKeyRef.current === filterKey) {
      return;
    }

    analytics("restaurants_empty", {
      search: normalizedFilters.search ?? null,
      timezone: normalizedFilters.timezone ?? "all",
      minCapacity: normalizedFilters.minCapacity ?? null,
    });

    emptyTrackedKeyRef.current = filterKey;
  }, [
    analytics,
    filterKey,
    filteredRestaurants.length,
    isInitialLoad,
    normalizedFilters.minCapacity,
    normalizedFilters.search,
    normalizedFilters.timezone,
    showError,
  ]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleTimezoneChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTimezoneFilter(event.target.value);
  };

  const handleMinCapacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/[^0-9]/g, "");
    setMinCapacityInput(next);
  };

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

  return (
    <div className="flex flex-col gap-[var(--sr-space-5)]">
      <div className="grid gap-[var(--sr-space-4)] rounded-xl border border-border/60 bg-card/60 p-[var(--sr-space-4)] shadow-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-[var(--sr-space-5)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[var(--sr-space-2)]">
          <Label htmlFor="restaurant-search" className="text-sm font-medium text-muted-foreground">
            Search
          </Label>
          <Input
            id="restaurant-search"
            inputMode="search"
            placeholder="Search restaurants…"
            value={searchTerm}
            onChange={handleSearchChange}
            autoComplete="off"
            aria-controls="restaurant-results"
            className="h-11 text-base md:text-sm"
          />
        </div>
        <div className="flex flex-col gap-[var(--sr-space-2)]">
          <Label htmlFor="restaurant-timezone" className="text-sm font-medium text-muted-foreground">
            Timezone
          </Label>
          <select
            id="restaurant-timezone"
            value={timezoneFilter}
            onChange={handleTimezoneChange}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          >
            <option value="all">All timezones</option>
            {uniqueTimezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-[var(--sr-space-2)]">
          <Label
            htmlFor="restaurant-min-capacity"
            className="text-sm font-medium text-muted-foreground"
          >
            Minimum seats
          </Label>
          <Input
            id="restaurant-min-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="e.g. 4"
            value={minCapacityInput}
            onChange={handleMinCapacityChange}
            autoComplete="off"
            aria-describedby="restaurant-min-capacity-helper"
            className="h-11 text-base md:text-sm"
          />
          <p
            id="restaurant-min-capacity-helper"
            className="text-xs text-muted-foreground"
          >
            Enter your party size to filter results.
          </p>
        </div>
      </div>

      {isFiltering ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Updating availability…
        </p>
      ) : null}

      {showError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="space-y-[var(--sr-space-3)] rounded-lg border border-destructive/40 bg-destructive/10 p-[var(--sr-space-4)] text-sm text-destructive"
        >
          <p className="font-semibold">We couldn’t load restaurants right now.</p>
          <p className="text-destructive/90">
            Check your connection and try again. If the problem continues, contact our support team.
          </p>
          <div className="flex flex-wrap items-center gap-[var(--sr-space-3)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isFetching}
            >
              Retry
            </Button>
            <a
              className="text-sm font-medium text-destructive underline underline-offset-4 hover:text-destructive/80"
              href={`mailto:${supportEmail}`}
            >
              Contact support
            </a>
          </div>
          {error instanceof Error ? (
            <span className="sr-only">Error details: {error.message}</span>
          ) : null}
        </div>
      ) : null}

      <div id="restaurant-results">
        {isInitialLoad ? (
          <ul
            className="grid gap-[var(--sr-space-5)] sm:grid-cols-2 lg:grid-cols-3"
            aria-hidden="true"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={`skeleton-${index}`}>
                <Card className="h-full border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] shadow-none">
                  <CardHeader className="space-y-[var(--sr-space-4)]">
                    <Skeleton className="h-7 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-11 w-full rounded-lg" />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : filteredRestaurants.length > 0 ? (
          <ul
            className="grid gap-[var(--sr-space-5)] sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Partner restaurants"
            id="restaurants-grid"
          >
            {filteredRestaurants.map((restaurant, index) => (
              <li key={restaurant.id}>
                <Card className="group h-full scroll-m-24 border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] shadow-[var(--sr-shadow-sm)] transition-transform duration-[var(--sr-duration-medium)] hover:-translate-y-0.5 hover:shadow-[var(--sr-shadow-md)] focus-within:-translate-y-0.5 focus-within:border-ring focus-within:shadow-[var(--sr-shadow-md)] focus-within:ring-2 focus-within:ring-ring/60">
                  <CardHeader className="space-y-[var(--sr-space-3)]">
                    <div className="flex items-center justify-between gap-[var(--sr-space-3)]">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {restaurant.name}
                      </CardTitle>
                      <Badge variant="secondary" className="font-medium uppercase tracking-wide">
                        {restaurant.timezone}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm text-muted-foreground">
                      {formatCapacity(restaurant.capacity)} · Select to open the booking flow.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={`/reserve/r/${restaurant.slug}`}
                      className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full")}
                      onClick={() => handleRestaurantClick(restaurant, index)}
                      aria-label={`Start booking at ${restaurant.name}`}
                      data-analytics="restaurant-select"
                    >
                      Book this restaurant
                    </a>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-[var(--sr-color-border)] bg-[var(--sr-color-surface)] p-[var(--sr-space-6)] text-center text-muted-foreground shadow-[var(--sr-shadow-sm)]">
            <h3 className="text-lg font-semibold text-foreground">No restaurants available</h3>
            <p className="mt-[var(--sr-space-2)] text-sm">
              Check back soon or reach out to our concierge team for personalised assistance.
            </p>
            <div className="mt-[var(--sr-space-4)] flex justify-center">
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
