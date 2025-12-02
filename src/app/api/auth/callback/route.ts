import { NextResponse } from "next/server";

import config from "@/config";
import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { normalizeEmail } from "@/server/customers";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const FALLBACK_REDIRECT_CONFIG = config.auth.callbackUrl ?? "/app";

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

/**
 * Checks if a user is a restaurant staff member.
 * Returns true if they have any restaurant memberships.
 */
async function isRestaurantMember(userId: string): Promise<boolean> {
  try {
    const serviceClient = getServiceSupabaseClient();
    
    const { data, error } = await serviceClient
      .from("restaurant_memberships")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      console.error("[auth/callback] Failed to check restaurant membership:", error.message);
      return false;
    }

    return data !== null && data.length > 0;
  } catch (error) {
    console.error("[auth/callback] Error checking restaurant membership:", error);
    return false;
  }
}

function resolveDestination({
  sanitizedRedirect,
  hostname,
  rootDomain,
  isStaff,
}: {
  sanitizedRedirect?: string;
  hostname: string;
  rootDomain: string;
  isStaff: boolean;
}): string {
  if (sanitizedRedirect) {
    return sanitizedRedirect;
  }

  if (isStaff) {
    return "/app/dashboard";
  }

  const hostFallback = defaultRedirectForHost(hostname, rootDomain);
  return FALLBACK_REDIRECT_CONFIG ?? hostFallback;
}

export const dynamic = "force-dynamic";

// This route is called after a successful login. It exchanges the code for a session and redirects to the callback URL (see config.js).
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");
  const hostname = parseHostname(req);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

  console.log("[auth/callback] Request received:", {
    hostname,
    rootDomain,
    hasCode: !!code,
    hasTokenHash: !!tokenHash,
    type,
    redirectedFrom,
    fullUrl: req.url,
    headers: {
      host: req.headers.get("host"),
      referer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
    },
  });

  const supabase = await getRouteHandlerSupabaseClient();
  let authSuccess = false;
  let userId: string | undefined;
  let userEmail: string | undefined;

  // Handle magic link with token_hash (from admin.generateLink)
  if (tokenHash && type) {
    console.log("[auth/callback] Attempting to verify OTP with token_hash...");
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // Supabase may send other types (e.g. "recovery", "signup"); pass through to avoid dropping valid links.
      type: type as "magiclink" | "email" | "signup" | "recovery" | "invite",
    });

    if (error) {
      console.error("[auth/callback] OTP verification failed:", {
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
    }

    console.log("[auth/callback] OTP verified successfully:", {
      userId: data?.user?.id,
      email: data?.user?.email,
      redirectedFrom,
    });
    
    authSuccess = true;
    userId = data?.user?.id;
    userEmail = data?.user?.email ?? undefined;
  }
  // Handle PKCE flow with code (from OAuth or standard magic link)
  else if (code) {
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
    }

    console.log("[auth/callback] Session exchanged successfully:", {
      userId: data?.user?.id,
      email: data?.user?.email,
      redirectedFrom,
    });

    authSuccess = true;
    userId = data?.user?.id;
    userEmail = data?.user?.email ?? undefined;
  } else {
    console.warn("[auth/callback] received request without code or token_hash parameter");
  }

  // Link auth user to existing customer records (for guests who booked before signing up)
  if (authSuccess && userId && userEmail) {
    await linkAuthUserToCustomers(userId, userEmail);

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

  // If there's a specific redirect requested and it's valid, use it
  const sanitizedRedirect = sanitizeRedirect(redirectedFrom, rootDomain);
  if (!sanitizedRedirect && redirectedFrom) {
    console.warn("[auth/callback] rejected redirect param:", redirectedFrom);
  }

  const isStaff = !sanitizedRedirect && userId ? await isRestaurantMember(userId) : false;
  const destination = resolveDestination({
    sanitizedRedirect,
    hostname,
    rootDomain,
    isStaff,
  });

  console.log("[auth/callback] Resolved destination:", {
    sanitizedRedirect,
    isStaff,
    fallback: destination,
    hostname,
  });

  // URL to redirect to after sign in process completes
  const absoluteDestination = toAbsoluteRedirectTarget(destination, rootDomain);
  const redirectUrl = new URL(absoluteDestination, requestUrl.origin);
  console.log("[auth/callback] Final redirect:", {
    destination,
    absoluteDestination,
    redirectUrl: redirectUrl.toString(),
    origin: requestUrl.origin,
  });

  return NextResponse.redirect(redirectUrl.toString());
}
