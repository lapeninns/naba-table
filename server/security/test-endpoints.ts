import { NextResponse, type NextRequest } from "next/server";

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
 * @returns NextResponse with 403 error when blocked, null otherwise
 * 
 * @example
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const guard = guardTestEndpoint(req);
 *   if (guard) return guard;
 *   
 *   // Proceed with test endpoint logic...
 * }
 * ```
 */
export function guardTestEndpoint(req: Pick<NextRequest, "headers" | "nextUrl">): NextResponse | null {
  const testConfig = env.testEndpoints;
  const isProd = env.node.appEnv === "production";

  const forbidden = (reason: string) => {
    // Log unauthorized test endpoint access attempt
    void recordObservabilityEvent({
      source: "security.test_endpoints",
      eventType: "test_endpoint.access_blocked",
      severity: "warning",
      context: {
        environment: isProd ? "production" : env.node.appEnv,
        reason,
      },
    });

    // Return 403 to avoid leaking presence of test endpoints
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 }
    );
  };

  if (!testConfig.enabled) {
    return forbidden("flag_disabled");
  }

  const headerToken = req.headers.get("x-test-token");
  const searchToken = req.nextUrl?.searchParams?.get?.("test_token");
  const providedToken = headerToken ?? searchToken;

  if (!testConfig.token) {
    return forbidden("token_not_configured");
  }

  if (!providedToken) {
    return forbidden("token_missing");
  }

  if (providedToken !== testConfig.token) {
    return forbidden("token_mismatch");
  }

  // Allow access in development/test environments
  return null;
}
