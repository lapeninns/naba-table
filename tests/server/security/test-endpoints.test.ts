import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { guardTestEndpoint } from "@/server/security/test-endpoints";

// Mock the env module
vi.mock("@/lib/env", () => ({
  env: {
    node: {
      env: "development",
    },
  },
}));

// Mock recordObservabilityEvent
vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn(),
}));

describe("guardTestEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("in development environment", () => {
    beforeEach(async () => {
      // Mock NODE_ENV as development
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "development";
    });

    it("returns null to allow access", () => {
      const result = guardTestEndpoint();
      expect(result).toBeNull();
    });

    it("does not log observability event", async () => {
      const { recordObservabilityEvent } = await import("@/server/observability");
      
      guardTestEndpoint();
      
      expect(recordObservabilityEvent).not.toHaveBeenCalled();
    });
  });

  describe("in test environment", () => {
    beforeEach(async () => {
      // Mock NODE_ENV as test
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "test";
    });

    it("returns null to allow access", () => {
      const result = guardTestEndpoint();
      expect(result).toBeNull();
    });
  });

  describe("in production environment", () => {
    beforeEach(async () => {
      // Mock NODE_ENV as production
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "production";
    });

    it("returns 404 Not Found response", () => {
      const result = guardTestEndpoint();
      
      expect(result).toBeInstanceOf(NextResponse);
      expect(result?.status).toBe(404);
    });

    it("returns error message in response body", async () => {
      const result = guardTestEndpoint();
      
      if (result) {
        const body = await result.json();
        expect(body).toEqual({ error: "Not found" });
      } else {
        throw new Error("Expected guard to return a response");
      }
    });

    it("logs observability event for blocked access", async () => {
      const { recordObservabilityEvent } = await import("@/server/observability");
      
      guardTestEndpoint();
      
      expect(recordObservabilityEvent).toHaveBeenCalledWith({
        source: "security.test_endpoints",
        eventType: "test_endpoint.access_blocked",
        severity: "warning",
        context: {
          environment: "production",
        },
      });
    });

    it("logs observability event asynchronously (fire and forget)", async () => {
      const { recordObservabilityEvent } = await import("@/server/observability");
      
      // Call guard
      guardTestEndpoint();
      
      // Observability event should be called (void call)
      expect(recordObservabilityEvent).toHaveBeenCalled();
    });
  });

  describe("response consistency", () => {
    it("returns 404 to be indistinguishable from non-existent route", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "production";
      
      const result = guardTestEndpoint();
      
      // Should return 404, not 403 (Forbidden), to hide endpoint existence
      expect(result?.status).toBe(404);
    });
  });

  describe("integration scenarios", () => {
    it("works correctly when used in route handler pattern", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "production";
      
      // Simulate route handler usage
      const guard = guardTestEndpoint();
      if (guard) {
        // Guard should block in production
        expect(guard.status).toBe(404);
        return;
      }
      
      // This should not be reached in production
      throw new Error("Guard should have blocked access");
    });

    it("allows endpoint logic to proceed in development", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "development";
      
      // Simulate route handler usage
      const guard = guardTestEndpoint();
      if (guard) {
        throw new Error("Guard should not block in development");
      }
      
      // Endpoint logic should proceed
      expect(guard).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles undefined NODE_ENV gracefully", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = undefined as any;
      
      // Should default to allowing access (safer default)
      const result = guardTestEndpoint();
      
      // If NODE_ENV is undefined, env.node.env will likely be "development"
      // or the function will treat it as non-production
      expect(result).toBeNull();
    });

    it("handles staging environment (non-production)", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "staging" as any;
      
      const result = guardTestEndpoint();
      
      // Staging is not "production", so should allow
      expect(result).toBeNull();
    });

    it("is case-sensitive for production check", async () => {
      const { env } = await import("@/lib/env");
      vi.mocked(env).node.env = "Production" as any;
      
      const result = guardTestEndpoint();
      
      // Should allow (not === "production")
      expect(result).toBeNull();
    });
  });
});
