/**
 * Integration Tests: Capacity API Endpoints
 * Story 3: API Integration Tests
 * 
 * These tests verify the complete flow from HTTP request to database.
 * Run against a test database or staging environment.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// =====================================================
// Test Configuration
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing Supabase credentials for integration tests");
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =====================================================
// Test Data Setup
// =====================================================

let testRestaurantId: string;
let testCustomerId: string;
const testDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  .toISOString()
  .split("T")[0]!;
let metricsWindowStart: string;
let overrideId: string | null = null;

beforeAll(async () => {
  // Get or create test restaurant
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (!restaurants || restaurants.length === 0) {
    throw new Error("No test restaurant found");
  }

  testRestaurantId = restaurants[0]!.id;

  // Get or create test customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("restaurant_id", testRestaurantId)
    .eq("email", "integration-test@example.com")
    .maybeSingle();

  if (customerError && customerError.code !== "PGRST116") {
    throw customerError;
  }

  if (customer) {
    testCustomerId = customer.id;
  } else {
    // Create test customer
    const { data: newCustomer, error: createError } = await supabase
      .from("customers")
      .insert({
        restaurant_id: testRestaurantId,
        email: "integration-test@example.com",
        full_name: "Integration Test Customer",
        phone: "+1234567890",
      })
      .select("id")
      .single();

    if (createError) throw createError;
    testCustomerId = newCustomer!.id;
  }

  // Setup test capacity rule (low capacity for easy testing)
  await supabase
    .from("restaurant_capacity_rules")
    .upsert({
      restaurant_id: testRestaurantId,
      max_covers: 20,
      max_parties: 10,
    });

  const { data: override, error: overrideError } = await supabase
    .from("restaurant_capacity_rules")
    .insert({
      restaurant_id: testRestaurantId,
      effective_date: testDate,
      max_covers: 8,
      label: "Integration Override",
      override_type: "event",
    })
    .select("id")
    .single();

  if (overrideError) throw overrideError;
  overrideId = override?.id ?? null;

  const now = new Date();
  const window = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0));
  metricsWindowStart = window.toISOString();

  console.log("[Integration Test Setup]", {
    restaurantId: testRestaurantId,
    customerId: testCustomerId,
    testDate,
  });
});

// =====================================================
// Tests: Capacity metrics & overrides
// =====================================================

describe("Capacity monitoring internals", () => {
  it("should increment capacity metrics via RPC", async () => {
    const { error } = await supabase.rpc("increment_capacity_metrics", {
      p_restaurant_id: testRestaurantId,
      p_window_start: metricsWindowStart,
      p_success_delta: 1,
      p_conflict_delta: 2,
      p_capacity_exceeded_delta: 3,
    });

    expect(error).toBeNull();

    const { data } = await supabase
      .from("capacity_metrics_hourly")
      .select("success_count, conflict_count, capacity_exceeded_count")
      .eq("restaurant_id", testRestaurantId)
      .eq("window_start", metricsWindowStart)
      .maybeSingle();

    expect(data?.success_count).toBeGreaterThanOrEqual(1);
    expect(data?.conflict_count).toBeGreaterThanOrEqual(2);
    expect(data?.capacity_exceeded_count).toBeGreaterThanOrEqual(3);
  });

  it("should store override metadata fields", async () => {
    const { data, error } = await supabase
      .from("restaurant_capacity_rules")
      .select("label, override_type")
      .eq("restaurant_id", testRestaurantId)
      .eq("effective_date", testDate)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.label).toBe("Integration Override");
    expect(data?.override_type).toBe("event");
  });
});

afterAll(async () => {
  // Cleanup test bookings
  await supabase
    .from("bookings")
    .delete()
    .eq("restaurant_id", testRestaurantId)
    .eq("customer_email", "integration-test@example.com");

  if (overrideId) {
    await supabase
      .from("restaurant_capacity_rules")
      .delete()
      .eq("id", overrideId);
  }

  if (metricsWindowStart) {
    await supabase
      .from("capacity_metrics_hourly")
      .delete()
      .eq("restaurant_id", testRestaurantId)
      .eq("window_start", metricsWindowStart);
  }

  // Note: Don't delete capacity rules or customer (might be used by other tests)
});

// =====================================================
// Tests: GET /api/availability
// =====================================================

describe("GET /api/availability", () => {
  it("should return availability for a specific time", async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/availability?restaurantId=${testRestaurantId}&date=${testDate}&time=19:00&partySize=4`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("available");
    expect(data).toHaveProperty("metadata");
    expect(data.metadata).toHaveProperty("maxCovers");
    expect(data.metadata).toHaveProperty("bookedCovers");
    expect(data.metadata).toHaveProperty("utilizationPercent");
  });

  it("should include alternatives when requested", async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/availability?restaurantId=${testRestaurantId}&date=${testDate}&time=19:00&partySize=4&includeAlternatives=true`
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    
    if (!data.available) {
      expect(data).toHaveProperty("alternatives");
      expect(Array.isArray(data.alternatives)).toBe(true);
    }
  });

  it("should return 400 for invalid query parameters", async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/availability?restaurantId=invalid-uuid&date=2025-10-20&time=19:00&partySize=4`
    );

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("should return 400 when time parameter is missing", async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/availability?restaurantId=${testRestaurantId}&date=${testDate}&partySize=4`
    );

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("Time parameter required");
  });

  it("should rate limit excessive requests", async () => {
    // Make 21 requests rapidly (limit is 20)
    const requests = Array.from({ length: 21 }, () =>
      fetch(
        `${API_BASE_URL}/api/availability?restaurantId=${testRestaurantId}&date=${testDate}&time=19:00&partySize=4`
      )
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  }, 10000); // Increase timeout for this test
});

// =====================================================
// Tests: POST /api/bookings (with capacity)
// =====================================================

describe("POST /api/bookings (with capacity enforcement)", () => {
  it("should create booking when capacity is available", async () => {
    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        restaurantId: testRestaurantId,
        date: testDate,
        time: "18:00",
        party: 4,
        bookingType: "dinner",
        seating: "any",
        name: "Integration Test",
        email: "integration-test@example.com",
        phone: "+1234567890",
        notes: "Test booking",
        marketingOptIn: false,
      }),
    });

    expect([200, 201]).toContain(response.status);

    const data = await response.json();
    expect(data).toHaveProperty("booking");
    expect(data.booking).toHaveProperty("reference");
    expect(data.booking.party_size).toBe(4);

    // Check if capacity metadata is included
    if (data.capacity) {
      expect(data.capacity).toHaveProperty("utilizationPercent");
      expect(data.capacity).toHaveProperty("bookedCovers");
    }
  });

  it("should reject booking when capacity exceeded", async () => {
    // First, fill capacity
    const fillRequests = Array.from({ length: 5 }, (_, i) =>
      fetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          date: testDate,
          time: "20:00",
          party: 4, // 5 * 4 = 20 covers (max)
          bookingType: "dinner",
          seating: "any",
          name: `Fill Test ${i}`,
          email: `fill-test-${i}@example.com`,
          phone: `+123456789${i}`,
        }),
      })
    );

    await Promise.all(fillRequests);

    // Now try to book one more (should exceed capacity)
    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        restaurantId: testRestaurantId,
        date: testDate,
        time: "20:00",
        party: 2,
        bookingType: "dinner",
        seating: "any",
        name: "Exceed Test",
        email: "exceed-test@example.com",
        phone: "+9999999999",
      }),
    });

    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.error).toBe("CAPACITY_EXCEEDED");
    expect(data).toHaveProperty("alternatives");
    expect(Array.isArray(data.alternatives)).toBe(true);
  }, 15000); // Increase timeout for multiple requests

  it("should handle idempotency correctly", async () => {
    const idempotencyKey = crypto.randomUUID();

    // Make same request twice
    const response1 = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        restaurantId: testRestaurantId,
        date: testDate,
        time: "17:00",
        party: 2,
        bookingType: "dinner",
        seating: "any",
        name: "Idempotency Test",
        email: "idempotency-test@example.com",
        phone: "+1111111111",
      }),
    });

    const response2 = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        restaurantId: testRestaurantId,
        date: testDate,
        time: "17:00",
        party: 2,
        bookingType: "dinner",
        seating: "any",
        name: "Idempotency Test",
        email: "idempotency-test@example.com",
        phone: "+1111111111",
      }),
    });

    expect([200, 201]).toContain(response1.status);
    expect(response2.status).toBe(200);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data2.duplicate).toBe(true);
    expect(data2.booking.id).toBe(data1.booking.id);
  });
});

// =====================================================
// Tests: Race Condition Handling
// =====================================================

describe("Race condition handling", () => {
  it.skip("should prevent overbooking under concurrent requests", async () => {
    // This test requires race condition simulation
    // Skip in normal test runs, run manually for verification
    
    const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
      fetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          date: testDate,
          time: "21:00",
          party: 3, // 10 * 3 = 30 covers (would exceed 20)
          bookingType: "dinner",
          seating: "any",
          name: `Concurrent Test ${i}`,
          email: `concurrent-${i}@example.com`,
          phone: `+200000000${i}`,
        }),
      })
    );

    const responses = await Promise.all(concurrentRequests);
    const successes = responses.filter(r => r.status === 201 || r.status === 200);
    const failures = responses.filter(r => r.status === 409);

    // Should have some successes and some failures
    expect(successes.length).toBeGreaterThan(0);
    expect(failures.length).toBeGreaterThan(0);

    // Verify total booked covers doesn't exceed capacity
    const { data: bookings } = await supabase
      .from("bookings")
      .select("party_size")
      .eq("restaurant_id", testRestaurantId)
      .eq("booking_date", testDate)
      .eq("start_time", "21:00")
      .not("status", "in", "(cancelled,no_show)");

    const totalCovers = bookings?.reduce((sum, b) => sum + b.party_size, 0) ?? 0;
    expect(totalCovers).toBeLessThanOrEqual(20); // Max capacity
  }, 30000);
});

/**
 * Running These Tests:
 * 
 * 1. Set environment variables:
 *    export NEXT_PUBLIC_SUPABASE_URL="your-url"
 *    export SUPABASE_SERVICE_ROLE_KEY="your-key"
 *    export NEXT_PUBLIC_SITE_URL="http://localhost:3000"
 * 
 * 2. Start Next.js dev server:
 *    pnpm dev
 * 
 * 3. Run tests:
 *    pnpm test:integration tests/integration/capacity-api.test.ts
 * 
 * Note: These tests hit the real database and API.
 * Use a test/staging environment, not production!
 */
