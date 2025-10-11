import { describe, expect, it } from "vitest";

import { generateCSV } from "@/lib/export/csv";
import type { CustomerWithProfile } from "@/server/ops/customers";

const SAMPLE: CustomerWithProfile[] = [
  {
    id: "cust-1",
    restaurantId: "rest-1",
    name: "Alex Rider",
    email: "alex@example.com",
    phone: "+441234567890",
    marketingOptIn: true,
    createdAt: "2025-01-01T10:00:00Z",
    updatedAt: "2025-01-01T10:00:00Z",
    firstBookingAt: "2025-01-05T10:00:00Z",
    lastBookingAt: "2025-02-02T19:00:00Z",
    totalBookings: 5,
    totalCovers: 12,
    totalCancellations: 1,
  },
  {
    id: "cust-2",
    restaurantId: "rest-1",
    name: "Jamie Fox",
    email: "",
    phone: "",
    marketingOptIn: false,
    createdAt: "2025-01-01T10:00:00Z",
    updatedAt: "2025-01-01T10:00:00Z",
    firstBookingAt: null,
    lastBookingAt: null,
    totalBookings: 0,
    totalCovers: 0,
    totalCancellations: 0,
  },
];

describe("generateCSV", () => {
  it("outputs a header row followed by customer data", () => {
    const csv = generateCSV(SAMPLE, [
      { header: "Name", accessor: (row) => row.name },
      { header: "Email", accessor: (row) => row.email },
      { header: "Total Bookings", accessor: (row) => row.totalBookings },
      { header: "First Booking", accessor: (row) => row.firstBookingAt ?? "Never" },
    ]);

    const rows = csv.split("\n");
    expect(rows[0]).toBe("Name,Email,Total Bookings,First Booking");
    expect(rows[1]).toContain("Alex Rider");
    expect(rows[1]).toContain("alex@example.com");
    expect(rows[1]).toContain("5");
    expect(rows[2]).toContain("Jamie Fox");
    expect(rows[2]).toContain("Never");
  });
});
