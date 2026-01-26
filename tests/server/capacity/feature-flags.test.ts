import { describe, expect, it } from "vitest";

import { getAllocatorAdjacencyMode, isAllocatorAdjacencyRequired } from "@/server/feature-flags";

describe("allocator adjacency rules", () => {
  it("always requires adjacency enforcement", () => {
    expect(isAllocatorAdjacencyRequired()).toBe(true);
  });

  it("uses connected adjacency mode", () => {
    expect(getAllocatorAdjacencyMode()).toBe("connected");
  });
});
