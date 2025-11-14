import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/capacity/cache", () => ({
  invalidateInventoryCache: vi.fn(),
  invalidateAdjacencyCache: vi.fn(),
}));

import { invalidateInventoryCache, invalidateAdjacencyCache } from "@/server/capacity/cache";
import { invalidateRestaurantCapacityCaches } from "@/server/ops/capacity-cache";

describe("invalidateRestaurantCapacityCaches", () => {
  it("invalidates both cache layers", () => {
    invalidateRestaurantCapacityCaches("rest-1");

    expect(invalidateInventoryCache).toHaveBeenCalledWith("rest-1");
    expect(invalidateAdjacencyCache).toHaveBeenCalledWith("rest-1");
  });

  it("swallows errors and logs warnings", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inventorySpy = vi.mocked(invalidateInventoryCache);
    const adjacencySpy = vi.mocked(invalidateAdjacencyCache);

    inventorySpy.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    adjacencySpy.mockImplementationOnce(() => {
      throw new Error("pow");
    });

    invalidateRestaurantCapacityCaches("rest-2");

    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});
