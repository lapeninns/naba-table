import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import {
  bandDuration,
  getVenuePolicy,
  serviceEnd,
  whichService,
  ServiceNotFoundError,
  ServiceOverrunError,
} from "@/server/capacity/policy";

describe("capacity policy helpers", () => {
  const policy = getVenuePolicy({ timezone: "Europe/London" });

  it("detects dinner service for 20:30 local time", () => {
    const start = DateTime.fromISO("2025-05-10T20:30:00Z");
    const service = whichService(start, policy);
    expect(service).toBe("dinner");
  });

  it("returns 150 minutes for a dinner party of eight", () => {
    expect(bandDuration("dinner", 8, policy)).toBe(90);
  });

  it("provides a 22:00 dinner service end boundary", () => {
    const start = DateTime.fromISO("2025-05-10T19:15:00+01:00");
    const end = serviceEnd("dinner", start, policy);
    expect(end.toFormat("HH:mm")).toBe("22:00");
  });

  it("handles DST fallback night without throwing", () => {
    const start = DateTime.fromISO("2025-10-26T20:30:00+01:00");
    const service = whichService(start, policy);
    expect(service).toBe("dinner");
  });

  it("throws when no service matches the provided timestamp", () => {
    const start = DateTime.fromISO("2025-05-10T10:00:00Z");
    expect(() => {
      const service = whichService(start, policy);
      if (!service) {
        throw new ServiceNotFoundError(start.setZone(policy.timezone));
      }
    }).toThrow(ServiceNotFoundError);
  });

  it("throws when requested duration overruns service end", () => {
    const start = DateTime.fromISO("2025-05-10T21:00:00+01:00");
    expect(() => {
      const diningEnd = start.plus({ minutes: bandDuration("dinner", 8, policy) });
      const serviceClose = serviceEnd("dinner", start, policy);
      if (diningEnd > serviceClose) {
        throw new ServiceOverrunError("dinner", diningEnd, serviceClose);
      }
    }).toThrow(ServiceOverrunError);
  });
});
