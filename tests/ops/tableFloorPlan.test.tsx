import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { TableFloorPlan } from "@/components/features/dashboard/TableFloorPlan";

const baseTable = {
  id: "table-1",
  tableNumber: "A1",
  capacity: 4,
  minPartySize: 1,
  maxPartySize: 4,
  section: "Main",
  category: "dining",
  seatingType: "standard",
  mobility: "movable",
  zoneId: "zone-1",
  status: "available",
  active: true,
  position: { x: 10, y: 20, rotation: 0 },
} as const;

function renderPlan(overrides: Partial<ComponentProps<typeof TableFloorPlan>> = {}) {
  const onToggle = vi.fn();

  render(
    <TableFloorPlan
      bookingId="booking-1"
      tables={[{ ...baseTable }]}
      holds={[]}
      conflicts={[]}
      bookingAssignments={[]}
      selectedTableIds={[]}
      onToggle={onToggle}
      {...overrides}
    />,
  );

  return { onToggle };
}

describe("TableFloorPlan", () => {
  it("renders positioned tables as toggle buttons", () => {
    const { onToggle } = renderPlan();

    const button = screen.getByRole("button", { name: /^A1/ });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith("table-1");
  });

  it("does not toggle tables held by another booking", () => {
    const { onToggle } = renderPlan({
      holds: [
        {
          id: "hold-other",
          bookingId: "booking-2",
          restaurantId: "restaurant-1",
          zoneId: "zone-1",
          startAt: "2025-01-01T18:00:00.000Z",
          endAt: "2025-01-01T20:00:00.000Z",
          expiresAt: "2025-01-01T18:05:00.000Z",
          tableIds: ["table-1"],
          createdBy: "user-2",
          createdByName: "Other Staff",
          createdByEmail: "ops@example.com",
          metadata: null,
          countdownSeconds: 90,
        },
      ],
    });

    const button = screen.getByRole("button", { name: /^A1/ });
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("falls back to chip list when tables lack coordinates", () => {
    renderPlan({
      tables: [
        {
          ...baseTable,
          id: "table-2",
          tableNumber: "B2",
          position: null,
        },
      ],
    });

    expect(screen.getByRole("button", { name: /B2/i })).toBeInTheDocument();
  });
});
