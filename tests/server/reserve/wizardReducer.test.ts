import { describe, expect, it } from "vitest";

import {
  getInitialDetails,
  getInitialState,
  reducer,
  toBookingOption,
  toSeatingOption,
  type ApiBooking,
  type State,
} from "@reserve/features/reservations/wizard/model/reducer";

function createBooking(overrides: Partial<ApiBooking> = {}): ApiBooking {
  return {
    id: "booking-1",
    restaurant_id: "rest-1",
    customer_id: "cust-1",
    booking_date: "2025-01-21",
    start_time: "18:30:00",
    end_time: "20:00:00",
    reference: "ABC123",
    party_size: 4,
    booking_type: "dine_in",
    seating_preference: "indoor",
    status: "confirmed",
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    customer_phone: "+15551234",
    notes: "Anniversary",
    source: "web",
    marketing_opt_in: true,
    loyalty_points_awarded: 25,
    created_at: "2025-01-20T18:00:00Z",
    updated_at: "2025-01-20T18:10:00Z",
    ...overrides,
  };
}

describe("reservation wizard reducer", () => {
  it("handles SET_CONFIRMATION by normalising booking and advancing to step 4", () => {
    const initialState = getInitialState();
    const booking = createBooking({ start_time: "18:30:00", notes: null });

    const next = reducer(initialState, {
      type: "SET_CONFIRMATION",
      payload: {
        bookings: [booking],
        booking,
        lastAction: "create",
      },
    });

    expect(next.step).toBe(4);
    expect(next.lastAction).toBe("create");
    expect(next.lastConfirmed).toEqual(booking);
    expect(next.details).toMatchObject({
      bookingId: "booking-1",
      date: "2025-01-21",
      time: "18:30",
      party: 4,
      notes: "",
      marketingOptIn: true,
    });
    expect(next.bookings).toHaveLength(1);
    expect(next.details.bookingType).toBe(toBookingOption(booking.booking_type));
    expect(next.details.seating).toBe(toSeatingOption(booking.seating_preference));
  });

  it("hydrates details when START_EDIT is dispatched", () => {
    const booking = createBooking({ notes: "Window seat" });
    const state: State = {
      ...getInitialState(),
      bookings: [booking],
      details: {
        ...getInitialDetails(),
        notes: "",
        name: "",
        email: "",
        phone: "",
      },
    };

    const next = reducer(state, { type: "START_EDIT", bookingId: booking.id });

    expect(next.step).toBe(1);
    expect(next.editingId).toBe(booking.id);
    expect(next.details).toMatchObject({
      bookingId: booking.id,
      date: booking.booking_date,
      time: "18:30",
      party: booking.party_size,
      name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
      notes: "Window seat",
    });
  });

  it("resets form while preserving remembered contacts", () => {
    const state: State = {
      ...getInitialState(),
      details: {
        ...getInitialDetails(),
        name: "Grace Hopper",
        email: "grace@example.com",
        phone: "+15550000",
        rememberDetails: true,
      },
    };

    const next = reducer(state, { type: "RESET_FORM", initialDetails: { party: 6 } });

    expect(next.step).toBe(1);
    expect(next.details.party).toBe(6);
    expect(next.details.name).toBe("Grace Hopper");
    expect(next.details.email).toBe("grace@example.com");
    expect(next.details.phone).toBe("+15550000");
    expect(next.details.rememberDetails).toBe(true);
  });

  it("hydrates contact details explicitly when HYDRATE_CONTACTS dispatched", () => {
    const state = getInitialState();

    const next = reducer(state, {
      type: "HYDRATE_CONTACTS",
      payload: {
        name: "Edsger Dijkstra",
        email: "edsger@example.com",
        phone: "+15559999",
        rememberDetails: false,
      },
    });

    expect(next.details).toMatchObject({
      name: "Edsger Dijkstra",
      email: "edsger@example.com",
      phone: "+15559999",
      rememberDetails: false,
    });
  });

  it("clears error state when SET_FIELD dispatched", () => {
    const state: State = {
      ...getInitialState(),
      error: "Previous error",
    };

    const next = reducer(state, { type: "SET_FIELD", key: "notes", value: "Updated notes" });

    expect(next.error).toBeNull();
    expect(next.details.notes).toBe("Updated notes");
  });
});
