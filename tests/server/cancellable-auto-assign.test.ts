import { describe, expect, it, vi } from "vitest";

import { CancellableAutoAssign } from "@/server/booking/auto-assign/cancellable-auto-assign";

describe("CancellableAutoAssign", () => {
  it("resolves when the operation completes before the timeout", async () => {
    const assigner = new CancellableAutoAssign(50);
    const op = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "ok";
    });

    await expect(assigner.runWithTimeout(op)).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("rejects with AbortError and invokes onAbort when the timeout elapses", async () => {
    const assigner = new CancellableAutoAssign(10);
    const onAbort = vi.fn();

    const start = Date.now();
    await expect(
      assigner.runWithTimeout(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "slow";
      }, onAbort),
    ).rejects.toMatchObject({ name: "AbortError" });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(80);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});
