import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { BookingStatusBadge } from "@/components/features/booking-state-machine/BookingStatusBadge";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("BookingStatusBadge", () => {
  it("renders without triggering the React maximum update depth warning", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      let result: ReturnType<typeof render> | undefined;
      expect(() => {
        result = render(
          <TooltipProvider>
            <BookingStatusBadge status="confirmed" />
          </TooltipProvider>,
        );
      }).not.toThrow();

      const badge = screen.getByRole("status", { name: /confirmed status/i });
      expect(badge).toBeInTheDocument();

      const hasUpdateDepthWarning = errorSpy.mock.calls.some(([message]) =>
        typeof message === "string" && message.includes("Maximum update depth exceeded"),
      );
      expect(hasUpdateDepthWarning).toBe(false);

      result?.unmount();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
