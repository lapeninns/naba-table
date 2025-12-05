import { getGreeting, getGreetingEmoji } from "@/guest/lib/formatters";
import { normalizeBookingsTab } from "@/guest/lib/validation";

describe("normalizeBookingsTab", () => {
  it("maps history to past", () => {
    expect(normalizeBookingsTab("history")).toBe("past");
    expect(normalizeBookingsTab("past")).toBe("past");
  });

  it("falls back to upcoming", () => {
    expect(normalizeBookingsTab(undefined)).toBe("upcoming");
    expect(normalizeBookingsTab("future")).toBe("upcoming");
  });
});

describe("greeting formatters", () => {
  it("returns greeting by hour", () => {
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    expect(getGreeting(morning)).toBe("Good morning");

    const evening = new Date();
    evening.setHours(19, 0, 0, 0);
    expect(getGreeting(evening)).toBe("Good evening");
  });

  it("returns emoji by hour", () => {
    const night = new Date();
    night.setHours(23, 0, 0, 0);
    expect(getGreetingEmoji(night)).toBe("🌙");
  });
});
