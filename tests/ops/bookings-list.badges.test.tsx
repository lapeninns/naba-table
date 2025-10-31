import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { BookingsList } from "@/components/features/dashboard/BookingsList";
import { TooltipProvider } from "@/components/ui/tooltip";

import type { OpsTodayBooking, OpsTodayBookingsSummary } from "@/types/ops";

vi.mock("@/hooks", () => ({
  useBookingRealtime: vi.fn(() => ({ isPolling: false, lastUpdatedAt: null })),
}));

vi.mock("@/components/features/dashboard/BookingDetailsDialog", () => ({
  BookingDetailsDialog: () => null,
}));

const asyncNoop = vi.fn().mockResolvedValue(undefined);
const createAssignmentStub = () => vi.fn().mockResolvedValue([] as OpsTodayBooking["tableAssignments"]);

afterEach(() => {
  vi.useRealTimers();
});

function buildBooking(partial: Partial<OpsTodayBooking>): OpsTodayBooking {
  return {
    id: "booking-id",
    status: "confirmed",
    startTime: "2025-10-17T11:30:00Z",
    endTime: "2025-10-17T13:00:00Z",
    partySize: 2,
    customerName: "Guest",
    customerEmail: null,
    customerPhone: null,
    notes: null,
    reference: null,
    details: null,
    source: null,
    loyaltyTier: null,
    loyaltyPoints: null,
    profileNotes: null,
    allergies: [],
    dietaryRestrictions: [],
    seatingPreference: null,
    marketingOptIn: null,
    tableAssignments: [
      {
        groupId: null,
        capacitySum: 2,
        members: [
          { tableId: "t1", tableNumber: "T01", capacity: 2, section: null },
        ],
      },
    ],
    requiresTableAssignment: false,
    checkedInAt: null,
    checkedOutAt: null,
    ...partial,
  };
}

const summary: OpsTodayBookingsSummary = {
  date: "2025-10-17",
  timezone: "UTC",
  restaurantId: "rest-1",
  totals: {
    total: 2,
    confirmed: 0,
    completed: 1,
    pending: 0,
    cancelled: 0,
    noShow: 0,
    upcoming: 0,
    covers: 2,
  },
  bookings: [],
};

describe("BookingsList lifecycle badges", () => {
  it("hides check-in/out chips for completed bookings", () => {
    const completed = buildBooking({
      id: "booking-completed",
      status: "completed",
      customerName: "Completed Guest",
      checkedInAt: "2025-10-17T11:40:00Z",
      checkedOutAt: "2025-10-17T13:05:00Z",
    });
    const checkedIn = buildBooking({
      id: "booking-checked-in",
      status: "checked_in",
      customerName: "Checked In Guest",
      checkedInAt: "2025-10-17T11:35:00Z",
      checkedOutAt: null,
    });

    const assignMock = createAssignmentStub();
    const unassignMock = createAssignmentStub();

    render(
      <TooltipProvider>
        <BookingsList
          bookings={[completed, checkedIn]}
          filter="all"
          summary={summary}
          allowTableAssignments
          onMarkNoShow={asyncNoop}
          onUndoNoShow={asyncNoop}
          onCheckIn={asyncNoop}
          onCheckOut={asyncNoop}
          pendingLifecycleAction={null}
          onAssignTable={assignMock}
          onUnassignTable={unassignMock}
          tableActionState={null}
        />
      </TooltipProvider>,
    );

    const completedHeading = screen.getByRole("heading", { name: "Completed Guest" });
    const completedChipsRow = completedHeading.parentElement;
    expect(completedChipsRow).not.toBeNull();
    if (!completedChipsRow) throw new Error("Completed chips row not found");

    expect(within(completedChipsRow).queryByText("Checked in")).not.toBeInTheDocument();
    expect(within(completedChipsRow).queryByText("Checked out")).not.toBeInTheDocument();

    const activeHeading = screen.getByRole("heading", { name: "Checked In Guest" });
    const activeChipsRow = activeHeading.parentElement;
    expect(activeChipsRow).not.toBeNull();
    if (!activeChipsRow) throw new Error("Active chips row not found");

    const checkInBadges = within(activeChipsRow).getAllByText("Checked in");
    expect(checkInBadges).toHaveLength(1);
  });

  it("renders merge metadata in table assignment badge", () => {
    const merged = buildBooking({
      id: "booking-merge",
      customerName: "Merge Guest",
      partySize: 6,
      tableAssignments: [
        {
          groupId: "merge-6-booking-merge-T2-1+T4-1",
          capacitySum: 6,
          members: [
            {
              tableId: "t2",
              tableNumber: "T2-1",
              capacity: 2,
              section: "Main",
            },
            {
              tableId: "t4",
              tableNumber: "T4-1",
              capacity: 4,
              section: "Main",
            },
          ],
        },
      ],
    });

    const assignMock = createAssignmentStub();
    const unassignMock = createAssignmentStub();

    render(
      <TooltipProvider>
        <BookingsList
          bookings={[merged]}
          filter="all"
          summary={{ ...summary, bookings: [merged] }}
          allowTableAssignments
          onMarkNoShow={asyncNoop}
          onUndoNoShow={asyncNoop}
          onCheckIn={asyncNoop}
          onCheckOut={asyncNoop}
          pendingLifecycleAction={null}
          onAssignTable={assignMock}
          onUnassignTable={unassignMock}
          tableActionState={null}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText(/Tables T2-1\s+\+\s+T4-1 · 6 seats/)).toBeInTheDocument();
  });

  it("locks table assignment for bookings whose service time has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-17T13:00:00Z"));

    const pastBooking = buildBooking({
      id: "booking-past",
      customerName: "Late Arrival",
      startTime: "2025-10-17T11:00:00Z",
      tableAssignments: [],
      requiresTableAssignment: true,
    });

    const assignMock = createAssignmentStub();
    const unassignMock = createAssignmentStub();

    render(
      <TooltipProvider>
        <BookingsList
          bookings={[pastBooking]}
          filter="all"
          summary={{ ...summary, bookings: [pastBooking] }}
          allowTableAssignments
          onMarkNoShow={asyncNoop}
          onUndoNoShow={asyncNoop}
          onCheckIn={asyncNoop}
          onCheckOut={asyncNoop}
          pendingLifecycleAction={null}
          onAssignTable={assignMock}
          onUnassignTable={unassignMock}
          tableActionState={null}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText(/Table assignment locked/i)).toBeInTheDocument();
    expect(screen.getByText(/Started/i)).toBeInTheDocument();
    expect(screen.getByText(/Check-in required/i)).toBeInTheDocument();
  });

  it("highlights bookings starting within fifteen minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-17T11:50:00Z"));

    const imminentBooking = buildBooking({
      id: "booking-imminent",
      customerName: "Soon Guest",
      startTime: "2025-10-17T12:00:00Z",
      tableAssignments: [],
      requiresTableAssignment: true,
    });

    const assignMock = createAssignmentStub();
    const unassignMock = createAssignmentStub();

    render(
      <TooltipProvider>
        <BookingsList
          bookings={[imminentBooking]}
          filter="all"
          summary={{ ...summary, bookings: [imminentBooking] }}
          allowTableAssignments
          onMarkNoShow={asyncNoop}
          onUndoNoShow={asyncNoop}
          onCheckIn={asyncNoop}
          onCheckOut={asyncNoop}
          pendingLifecycleAction={null}
          onAssignTable={assignMock}
          onUnassignTable={unassignMock}
          tableActionState={null}
        />
      </TooltipProvider>,
    );

    expect(screen.getAllByText(/Starts in 10 min/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Check-in required/i)).not.toBeInTheDocument();
  });

  it("flags check-out when service end time passes for checked-in guests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-17T14:30:00Z"));

    const checkedIn = buildBooking({
      id: "booking-checkout",
      customerName: "Needs Checkout",
      startTime: "2025-10-17T12:00:00Z",
      endTime: "2025-10-17T14:00:00Z",
      status: "checked_in",
      checkedInAt: "2025-10-17T12:05:00Z",
      tableAssignments: [
        {
          groupId: null,
          capacitySum: 2,
          members: [{ tableId: "t1", tableNumber: "T01", capacity: 2, section: null }],
        },
      ],
    });

    const assignMock = createAssignmentStub();
    const unassignMock = createAssignmentStub();

    render(
      <TooltipProvider>
        <BookingsList
          bookings={[checkedIn]}
          filter="all"
          summary={{ ...summary, bookings: [checkedIn] }}
          allowTableAssignments
          onMarkNoShow={asyncNoop}
          onUndoNoShow={asyncNoop}
          onCheckIn={asyncNoop}
          onCheckOut={asyncNoop}
          pendingLifecycleAction={null}
          onAssignTable={assignMock}
          onUnassignTable={unassignMock}
          tableActionState={null}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText(/Check-out required/i)).toBeInTheDocument();
    expect(screen.queryByText(/Check-in required/i)).not.toBeInTheDocument();
  });
});
