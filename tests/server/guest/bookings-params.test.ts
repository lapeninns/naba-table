import { buildBookingsQueryKeyParams, buildBookingsSearchParams } from "@/guest/services/bookings-params";

describe("buildBookingsSearchParams", () => {
  it("applies defaults and me=1", () => {
    const params = buildBookingsSearchParams();
    expect(params.get("me")).toBe("1");
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("10");
  });

  it("coerces date values to ISO strings", () => {
    const date = new Date("2025-01-02T15:00:00Z");
    const params = buildBookingsSearchParams({ from: date, to: date });
    expect(params.get("from")).toBe(date.toISOString());
    expect(params.get("to")).toBe(date.toISOString());
  });

  it("omits invalid dates", () => {
    const params = buildBookingsSearchParams({ from: "not-a-date" });
    expect(params.has("from")).toBe(false);
  });
});

describe("buildBookingsQueryKeyParams", () => {
  it("returns stable record for query keys", () => {
    const record = buildBookingsQueryKeyParams({ status: "confirmed", page: 2 });
    expect(record).toMatchObject({ me: "1", status: "confirmed", page: "2", pageSize: "10" });
  });
});
