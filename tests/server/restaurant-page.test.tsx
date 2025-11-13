import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestaurantDirectoryPage from "@/app/(guest-public)/(guest-experience)/restaurant/page";
import { listRestaurants } from "@/server/restaurants";

import type { RestaurantSummary } from "@/lib/restaurants/types";

vi.mock("@/server/restaurants", () => {
  class MockListRestaurantsError extends Error {
    constructor(message?: string) {
      super(message ?? "mock failure");
      this.name = "ListRestaurantsError";
    }
  }

  return {
    listRestaurants: vi.fn(),
    ListRestaurantsError: MockListRestaurantsError,
  };
});

const mockListRestaurants = vi.mocked(listRestaurants);

const sampleRestaurants: RestaurantSummary[] = [
  {
    id: "rest-1",
    name: "Lisbon Rooftop",
    slug: "lisbon-rooftop",
    timezone: "Europe/Lisbon",
    capacity: 80,
  },
  {
    id: "rest-2",
    name: "Kyoto Garden",
    slug: "kyoto-garden",
    timezone: "Asia/Tokyo",
    capacity: 42,
  },
];

function renderWithProviders(element: React.ReactElement) {
  const queryClient = new QueryClient();
  const utils = render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
  return { ...utils, queryClient };
}

beforeEach(() => {
  mockListRestaurants.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("/restaurant page", () => {
  it("renders the hero copy and prefetched restaurants", async () => {
    mockListRestaurants.mockResolvedValue(sampleRestaurants);

    const page = await RestaurantDirectoryPage();
    const { queryClient } = renderWithProviders(page);

    expect(await screen.findByRole("heading", { name: /browse partner restaurants/i })).toBeInTheDocument();
    expect(await screen.findByText(sampleRestaurants[0].name)).toBeInTheDocument();

    queryClient.clear();
  });

  it("surfaces the error state when initial load fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockListRestaurants.mockRejectedValue(new Error("boom"));

    const page = await RestaurantDirectoryPage();
    const { queryClient } = renderWithProviders(page);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load restaurants right now.");

    queryClient.clear();
    consoleErrorSpy.mockRestore();
  });
});
