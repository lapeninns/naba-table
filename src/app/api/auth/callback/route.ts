import { NextResponse } from "next/server";

import config from "@/config";
import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { normalizeEmail } from "@/server/customers";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

/**
 * Links an auth user to existing customer records that match their email.
 * This ensures customers who made bookings before signing up can access their booking history.
 */
async function linkAuthUserToCustomers(authUserId: string, email: string): Promise<void> {
  try {
    const serviceClient = getServiceSupabaseClient();
    const normalizedEmail = normalizeEmail(email);

    // Find all customer records with this email that don't have an auth_user_id
    const { data: customers, error: findError } = await serviceClient
      .from("customers")
      .select("id")
      .eq("email_normalized", normalizedEmail)
      .is("auth_user_id", null);

    if (findError) {
      console.error("[auth/callback] Failed to find customers for linking:", findError.message);
      return;
    }

    if (!customers || customers.length === 0) {
      console.log("[auth/callback] No unlinked customers found for email:", normalizedEmail);
      return;
    }

    // Link all matching customer records to this auth user
    const customerIds = customers.map((c) => c.id);
    const { error: updateError } = await serviceClient
      .from("customers")
      .update({ auth_user_id: authUserId })
      .in("id", customerIds);

    if (updateError) {
      console.error("[auth/callback] Failed to link customers to auth user:", updateError.message);
      return;
    }

    console.log("[auth/callback] Successfully linked auth user to customers:", {
      authUserId,
      email: normalizedEmail,
      customerCount: customerIds.length,
    });
  } catch (error) {
    // Don't fail the auth callback if linking fails - it's not critical
    console.error("[auth/callback] Error linking auth user to customers:", error);
  }
}

export const dynamic = "force-dynamic";

const FALLBACK_REDIRECT_CONFIG = config.auth.callbackUrl ?? "/app";

// This route is called after a successful login. It exchanges the code for a session and redirects to the callback URL (see config.js).
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");
  const hostname = parseHostname(req);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

  console.log("[auth/callback] Request received:", {
    hostname,
    rootDomain,
    hasCode: !!code,
    redirectedFrom,
    fullUrl: req.url,
    headers: {
      host: req.headers.get("host"),
      referer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
    },
  });

  const resolveDestination = () => {
    const sanitized = sanitizeRedirect(redirectedFrom, rootDomain);
    if (!sanitized) {
      if (redirectedFrom) {
        console.warn("[auth/callback] rejected redirect param", redirectedFrom);
      }
      const fallback = FALLBACK_REDIRECT_CONFIG ?? defaultRedirectForHost(hostname, rootDomain);
      console.log("[auth/callback] Using fallback destination:", fallback);
      return fallback;
    }
    console.log("[auth/callback] Using sanitized destination:", sanitized);
    return sanitized;
  };

  if (code) {
    const supabase = await getRouteHandlerSupabaseClient();
    console.log("[auth/callback] Attempting to exchange code for session...");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Session exchange failed:", {
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      });

      // Redirect to login page with error
      const loginUrl = new URL(config.auth.loginUrl, requestUrl.origin);
      loginUrl.searchParams.set("error", "auth_failed");
      loginUrl.searchParams.set("message", "Authentication link has expired or is invalid. Please try again.");
      console.log("[auth/callback] Redirecting to login due to error:", loginUrl.toString());
      return NextResponse.redirect(loginUrl.toString());
    } else {
      console.log("[auth/callback] Session exchanged successfully:", {
        userId: data?.user?.id,
        email: data?.user?.email,
        redirectedFrom,
      });

      // Link auth user to existing customer records (for guests who booked before signing up)
      if (data?.user?.id && data?.user?.email) {
        await linkAuthUserToCustomers(data.user.id, data.user.email);
      }

      // Verify session was actually set when available (mocked clients may omit getUser)
      const maybeGetUser = (supabase.auth as { getUser?: () => Promise<{ data: { user: unknown } | null; error?: { message?: string } | null }> }).getUser;
      if (typeof maybeGetUser === "function") {
        const { data: verifiedUser, error: verifyError } = await maybeGetUser();
        console.log("[auth/callback] Session verification:", {
          hasUser: !!verifiedUser?.user,
          sessionUserId: verifiedUser?.user ? (verifiedUser.user as { id?: string }).id : undefined,
          verifyError: verifyError?.message,
        });
      }
    }
  } else {
    console.warn("[auth/callback] received request without code parameter");
  }

  // URL to redirect to after sign in process completes
  const destination = toAbsoluteRedirectTarget(resolveDestination(), rootDomain);
  const redirectUrl = new URL(destination, requestUrl.origin);
  console.log("[auth/callback] Final redirect:", {
    destination,
    redirectUrl: redirectUrl.toString(),
    origin: requestUrl.origin,
  });

  return NextResponse.redirect(redirectUrl.toString());
}
