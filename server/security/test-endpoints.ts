import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { recordObservabilityEvent } from "@/server/observability";

/**
 * Guards test/dev endpoints from production access.
 * 
 * Returns 404 response in production environment to prevent:
 * - Test data pollution in production database
 * - Unauthorized access to development utilities
 * - Discovery of internal testing mechanisms
 * 
 * In development/test environments, returns null to allow normal operation.
 * 
 * @returns NextResponse with 404 error in production, null otherwise
 * 
 * @example
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const guard = guardTestEndpoint();
 *   if (guard) return guard;
 *   
 *   // Proceed with test endpoint logic...
 * }
 * ```
 */
export function guardTestEndpoint(): NextResponse | null {
  const isProd = env.node.env === "production";

  if (isProd) {
    // Log unauthorized test endpoint access attempt
    void recordObservabilityEvent({
      source: "security.test_endpoints",
      eventType: "test_endpoint.access_blocked",
      severity: "warning",
      context: {
        environment: "production",
      },
    });

    // Return 404 to be indistinguishable from non-existent route
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  // Allow access in development/test environments
  return null;
}
