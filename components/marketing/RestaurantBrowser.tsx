"use client";

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";

import type { AnalyticsEvent } from "@/lib/analytics";
import { track } from "@/lib/analytics";
import { fetchJson } from "@/lib/http/fetchJson";
import type { RestaurantFilters, RestaurantSummary } from "@/lib/restaurants/types";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsHandler = (event: AnalyticsEvent, props?: Record<string, unknown>) => void;

type RestaurantBrowserProps = {
  initialRestaurants: RestaurantSummary[];
  initialError?: boolean;
  fetchRestaurants?: (filters: RestaurantFilters) => Promise<RestaurantSummary[]>;
  analytics?: AnalyticsHandler;
};

type RestaurantsResponse = {
  data: RestaurantSummary[];
};

const defaultFetchRestaurants = async (filters: RestaurantFilters) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.timezone) params.set("timezone", filters.timezone);
  if (typeof filters.minCapacity === "number") {
    params.set("minCapacity", String(filters.minCapacity));
  }

  const query = params.toString();
  const url = query.length > 0 ? `/api/restaurants?${query}` : "/api/restaurants";
  const response = await fetchJson<RestaurantsResponse>(url);
  return response.data ?? [];
};

const formatCapacity = (capacity: number | null) => {
  if (capacity === null || capacity === undefined) return "Capacity not set";
  if (capacity <= 0) return "Capacity not set";
  return `${capacity} seats`;
};

export function RestaurantBrowser({
  initialRestaurants,
  initialError = false,
  fetchRestaurants = defaultFetchRestaurants,
  analytics = track,
}: RestaurantBrowserProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState<string>("all");
  const deferredSearch = useDeferredValue(searchTerm);

  const normalizedFilters = useMemo<RestaurantFilters>(() => {
    const search = deferredSearch.trim();
    return {
      search: search.length > 0 ? search : undefined,
      timezone: timezoneFilter !== "all" ? timezoneFilter : undefined,
    };
  }, [deferredSearch, timezoneFilter]);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.restaurants.list(normalizedFilters),
    queryFn: () => fetchRestaurants(normalizedFilters),
    initialData: initialRestaurants,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount) => failureCount < 2,
  });

  const restaurants = data ?? [];

  const uniqueTimezones = useMemo(() => {
    const source = restaurants.length > 0 ? restaurants : initialRestaurants;
    const set = new Set<string>();
    source.forEach((restaurant) => {
      if (restaurant.timezone) {
        set.add(restaurant.timezone);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [restaurants, initialRestaurants]);

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

  const hasInitialError = initialError && initialRestaurants.length === 0 && restaurants.length === 0;
  const showError = isError || hasInitialError;

  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (hasTrackedView.current) return;
    if (restaurants.length === 0) return;
    analytics("restaurant_list_viewed", {
      timezone: normalizedFilters.timezone ?? "all",
      total: restaurants.length,
    });
    hasTrackedView.current = true;
  }, [analytics, restaurants.length, normalizedFilters.timezone, restaurants]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleTimezoneChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTimezoneFilter(event.target.value);
  };

  const handleRestaurantClick = (restaurant: RestaurantSummary, index: number) => {
    analytics("restaurant_selected", {
      restaurantId: restaurant.id,
      position: index,
    });
  };

  const isInitialLoad = isLoading && initialRestaurants.length === 0;
  const isFiltering = isFetching && !isInitialLoad;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-2">
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
      </div>

      {isFiltering ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Updating availability…
        </p>
      ) : null}

      {showError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          We couldn’t load restaurants right now. Please refresh, or contact support if the issue
          persists.
          {error instanceof Error ? (
            <span className="sr-only">Error details: {error.message}</span>
          ) : null}
        </div>
      ) : null}

      <div id="restaurant-results">
        {isInitialLoad ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={`skeleton-${index}`}>
                <Card className="h-full border-border/50 bg-card/80 shadow-none">
                  <CardHeader className="space-y-4">
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
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Partner restaurants"
            id="restaurants-grid"
          >
            {filteredRestaurants.map((restaurant, index) => (
              <li key={restaurant.id}>
                <Card className="group h-full scroll-m-24 border-border/70 bg-card/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border focus-within:-translate-y-0.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/60">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
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
                      className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
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
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <h3 className="text-lg font-semibold text-foreground">No restaurants available</h3>
            <p className="mt-2 text-sm">
              Check back soon or reach out to our concierge team for personalised assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
