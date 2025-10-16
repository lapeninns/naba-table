/**
 * Unit Tests: CapacityService
 * Story 2: Availability Checking Logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkSlotAvailability, findAlternativeSlots } from "../service";
import type { AvailabilityCheckParams } from "../types";

// =====================================================
// Mock Supabase Client
// =====================================================

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

// Mock the server/ops/capacity module
vi.mock("@/server/ops/capacity", () => ({
  getServicePeriodsWithCapacity: vi.fn(),
  calculateCapacityUtilization: vi.fn(),
}));

// Mock Supabase client factory
vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => mockSupabase,
}));

// Import mocked functions
import { getServicePeriodsWithCapacity } from "@/server/ops/capacity";

// =====================================================
// Test Data
// =====================================================

const mockPeriod = {
  periodId: "period-1",
  periodName: "Dinner Service",
  startTime: "17:00",
  endTime: "22:00",
  maxCovers: 40,
  maxParties: 20,
  dayOfWeek: null,
};

const mockBookings = [
  { party_size: 4 },
  { party_size: 6 },
  { party_size: 2 },
]; // Total: 12 covers, 3 parties

// =====================================================
// Tests: checkSlotAvailability
// =====================================================

describe("checkSlotAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return available=true when under capacity", async () => {
    // Setup
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
    });

    const params: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 4,
    };

    // Execute
    const result = await checkSlotAvailability(params);

    // Assert
    expect(result.available).toBe(true);
    expect(result.metadata.bookedCovers).toBe(12);
    expect(result.metadata.maxCovers).toBe(40);
    expect(result.metadata.availableCovers).toBe(28); // 40 - 12
    expect(result.metadata.utilizationPercent).toBe(30); // 12/40 = 30%
  });

  it("should return available=false when capacity exceeded", async () => {
    // Setup
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    // Mock 38 covers already booked (max is 40)
    const manyBookings = Array(19).fill({ party_size: 2 }); // 19 * 2 = 38
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: manyBookings, error: null }),
    });

    const params: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 4, // Would exceed 40
    };

    // Execute
    const result = await checkSlotAvailability(params);

    // Assert
    expect(result.available).toBe(false);
    expect(result.reason).toContain("Maximum capacity");
    expect(result.metadata.bookedCovers).toBe(38);
    expect(result.metadata.utilizationPercent).toBe(95); // 38/40
  });

  it("should handle restaurant without capacity rules (unlimited)", async () => {
    // Setup - period with no capacity rules
    const unlimitedPeriod = {
      ...mockPeriod,
      maxCovers: null,
      maxParties: null,
    };
    
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([unlimitedPeriod]);

    const params: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 100, // Large party
    };

    // Execute
    const result = await checkSlotAvailability(params);

    // Assert
    expect(result.available).toBe(true);
    expect(result.metadata.maxCovers).toBeNull();
    expect(result.metadata.utilizationPercent).toBe(0);
  });

  it("should respect stricter overrides", async () => {
    const overridePeriod = {
      ...mockPeriod,
      maxCovers: 10,
      maxParties: 5,
    };

    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([overridePeriod]);

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [{ party_size: 6 }],
        error: null,
      }),
    });

    const result = await checkSlotAvailability({
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 5,
    });

    expect(result.available).toBe(false);
    expect(result.reason).toContain("Maximum capacity of 10 covers exceeded");
  });

  it("should check maxParties limit", async () => {
    // Setup
    const periodWithPartyLimit = {
      ...mockPeriod,
      maxParties: 5,
    };
    
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([periodWithPartyLimit]);
    
    // Already 5 parties booked
    const fiveParties = Array(5).fill({ party_size: 2 });
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: fiveParties, error: null }),
    });

    const params: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 2, // Covers available, but parties limit reached
    };

    // Execute
    const result = await checkSlotAvailability(params);

    // Assert
    expect(result.available).toBe(false);
    expect(result.reason).toContain("Maximum of 5 bookings exceeded");
    expect(result.metadata.bookedParties).toBe(5);
  });

  it("should match booking time to correct period", async () => {
    // Setup - multiple periods
    const lunchPeriod = {
      periodId: "lunch",
      periodName: "Lunch Service",
      startTime: "11:00",
      endTime: "15:00",
      maxCovers: 30,
      maxParties: null,
      dayOfWeek: null,
    };
    
    const dinnerPeriod = {
      ...mockPeriod,
      startTime: "17:00",
      endTime: "22:00",
    };
    
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([lunchPeriod, dinnerPeriod]);
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
    });

    // Test dinner time
    const dinnerParams: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00", // Dinner period
      partySize: 4,
    };

    const result = await checkSlotAvailability(dinnerParams);

    // Assert - should use dinner period capacity
    expect(result.metadata.servicePeriod).toBe("Dinner Service");
    expect(result.metadata.maxCovers).toBe(40);
  });

  it("should handle edge case: exactly at capacity", async () => {
    // Setup
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    // 36 covers booked, requesting 4 more = exactly 40
    const bookings = Array(18).fill({ party_size: 2 }); // 36
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: bookings, error: null }),
    });

    const params: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 4, // Exactly fits
    };

    // Execute
    const result = await checkSlotAvailability(params);

    // Assert - should still be available
    expect(result.available).toBe(true);
    expect(result.metadata.bookedCovers).toBe(36);
    expect(result.metadata.availableCovers).toBe(4);
  });

  it("should throw error on database failure", async () => {
    // Setup
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      }),
    });

    const params: AvailabilityCheckParams = {
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      time: "19:00",
      partySize: 4,
    };

    // Execute & Assert
    await expect(checkSlotAvailability(params)).rejects.toThrow("Failed to fetch bookings");
  });
});

// =====================================================
// Tests: findAlternativeSlots
// =====================================================

describe("findAlternativeSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return alternative times sorted by proximity", async () => {
    // Setup
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    // Mock: 19:00 is full, but 18:45 and 19:15 are available
    mockSupabase.from.mockImplementation(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockImplementation(function() {
          // @ts-ignore - accessing 'this' context from mock chain
          const lastEqCall = this.eq.mock.calls[this.eq.mock.calls.length - 1];
          
          // Return different data based on time parameter
          if (lastEqCall && lastEqCall[1] === "2025-10-20") {
            return Promise.resolve({ data: [], error: null }); // All times available
          }
          
          return Promise.resolve({ data: [], error: null });
        }),
      };
    });

    // Execute
    const alternatives = await findAlternativeSlots({
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      partySize: 4,
      preferredTime: "19:00",
      maxAlternatives: 5,
    });

    // Assert
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.length).toBeLessThanOrEqual(5);
    
    // All should be available
    alternatives.forEach(slot => {
      expect(slot.available).toBe(true);
    });
    
    // Should include times near 19:00
    const times = alternatives.map(s => s.time);
    expect(times).toContain("18:45"); // 15 min before
    expect(times).toContain("19:15"); // 15 min after
  });

  it("should return empty array when no alternatives available", async () => {
    // Setup - all slots full
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    // All slots at max capacity
    const fullBookings = Array(20).fill({ party_size: 2 }); // 40 covers
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: fullBookings, error: null }),
    });

    // Execute
    const alternatives = await findAlternativeSlots({
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      partySize: 4,
      preferredTime: "19:00",
      maxAlternatives: 5,
    });

    // Assert
    expect(alternatives).toHaveLength(0);
  });

  it("should respect maxAlternatives limit", async () => {
    // Setup
    vi.mocked(getServicePeriodsWithCapacity).mockResolvedValue([mockPeriod]);
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    // Execute with limit of 3
    const alternatives = await findAlternativeSlots({
      restaurantId: "restaurant-1",
      date: "2025-10-20",
      partySize: 4,
      preferredTime: "19:00",
      maxAlternatives: 3,
    });

    // Assert
    expect(alternatives.length).toBeLessThanOrEqual(3);
  });
});
