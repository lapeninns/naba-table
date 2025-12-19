import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingListClient } from "@/components/features/booking/list/BookingListClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/guest/bookings",
  useSearchParams: () => new URLSearchParams(),
}));

const useGuestBookingsMock = vi.fn();

vi.mock("@/guest/hooks", () => ({
  useGuestBookings: (...args: unknown[]) => useGuestBookingsMock(...args),
  useGuestProfile: () => ({ data: undefined }),
  useGuestSession: () => ({ user: null, status: "unauthenticated", session: null }),
}));

const renderWithProviders = () => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingListClient />
    </QueryClientProvider>,
  );
};

describe("BookingListClient states", () => {
  afterEach(() => {
    cleanup();
    useGuestBookingsMock.mockReset();
  });

  it("renders error state when query errors", () => {
    useGuestBookingsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders();
    expect(screen.getByText(/couldn.t load your bookings/i)).toBeInTheDocument();
  });

  it("renders empty state when no bookings", () => {
    useGuestBookingsMock.mockReturnValue({
      data: { items: [], pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false } },
      isLoading: false,
      isError: false,
    });

    renderWithProviders();

    expect(screen.getByText(/No bookings yet/i)).toBeInTheDocument();
  });
});
