import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import config from "@/config";
import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { env } from "@/lib/env";
import { normalizeEmail } from "@/server/customers";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const secureCookies = env.node.appEnv !== "development";

const FALLBACK_REDIRECT_CONFIG = config.auth.callbackUrl ?? "/app";

function applyCookieDefaults(options: Record<string, unknown> = {}) {
  const cookieConfig: Record<string, unknown> = {
    ...options,
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax" as const,
    path: "/",
  };

  // Set domain for cross-subdomain cookie sharing in production
  if (ROOT_DOMAIN !== "localhost") {
    cookieConfig.domain = `.${ROOT_DOMAIN}`;
  }

  return cookieConfig;
}

async function linkAuthUserToCustomers(authUserId: string, email: string): Promise<void> {
  try {
    const serviceClient = getServiceSupabaseClient();
    const normalizedEmail = normalizeEmail(email);

    const { data: customers, error: findError } = await serviceClient
      .from("customers")
      .select("id")
      .eq("email_normalized", normalizedEmail)
      .is("auth_user_id", null);

    if (findError) {
      console.error("[auth/callback] Failed to find customers for linking:", findError.message);
      return;
    }

    if (!customers?.length) {
      return;
    }

    const customerIds = customers.map((c) => c.id);
    const { error: updateError } = await serviceClient
      .from("customers")
      .update({ auth_user_id: authUserId })
      .in("id", customerIds);

    if (updateError) {
      console.error("[auth/callback] Failed to link customers to auth user:", updateError.message);
      return;
    }

    console.log("[auth/callback] Linked auth user to customers", {
      authUserId,
      email: normalizedEmail,
      customerCount: customerIds.length,
    });
  } catch (error) {
    console.error("[auth/callback] Error linking auth user to customers:", error);
  }
}

// This route is called after a successful login. It exchanges the code for a session and redirects to the callback URL (see config.js).
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
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

  // Resolve destination URL first so we can create redirect response
  const destination = toAbsoluteRedirectTarget(resolveDestination(), rootDomain);
  const redirectUrl = new URL(destination, requestUrl.origin);

  if (code || tokenHash) {
    const cookieStore = await cookies();
    
    // Create Supabase client that writes cookies to the cookie store
    const supabase = createServerClient<Database>(
      env.supabase.url,
      env.supabase.anonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set({ name, value, ...applyCookieDefaults(options) });
              });
            } catch (error) {
              // Cookie writes can fail in certain server contexts; log but continue
              console.warn("[auth/callback] Cookie write warning:", error instanceof Error ? error.message : String(error));
            }
          },
        },
      }
    );

    if (code) {
      console.log("[auth/callback] Attempting to exchange code for session...");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[auth/callback] Session exchange failed:", {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
        });

        const loginUrl = new URL(config.auth.loginUrl, requestUrl.origin);
        loginUrl.searchParams.set("error", "auth_failed");
        loginUrl.searchParams.set("message", "Authentication link has expired or is invalid. Please try again.");
        console.log("[auth/callback] Redirecting to login due to error:", loginUrl.toString());
        return NextResponse.redirect(loginUrl.toString());
      } else {
        console.log("[auth/callback] Session exchanged successfully:", {
          userId: data.user?.id,
          email: data.user?.email,
          redirectedFrom,
        });

        if (data.user?.id && data.user?.email) {
          await linkAuthUserToCustomers(data.user.id, data.user.email);
        }

        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[auth/callback] Session verification:", {
          hasSession: !!sessionData.session,
          sessionUserId: sessionData.session?.user?.id,
        });
      }
    } else if (tokenHash) {
      console.log("[auth/callback] Verifying token_hash for magic link...");
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });

      if (error) {
        console.error("[auth/callback] token_hash verification failed:", {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
        });
        const loginUrl = new URL(config.auth.loginUrl, requestUrl.origin);
        loginUrl.searchParams.set("error", "auth_failed");
        loginUrl.searchParams.set("message", "Authentication link has expired or is invalid. Please try again.");
        return NextResponse.redirect(loginUrl.toString());
      }

      console.log("[auth/callback] token_hash verified", {
        userId: data.session?.user?.id,
        email: data.session?.user?.email,
      });

      if (data.session?.user?.id && data.session?.user?.email) {
        await linkAuthUserToCustomers(data.session.user.id, data.session.user.email);
      }
    }
  } else {
    console.warn("[auth/callback] No code or token_hash parameter in request - possible direct access or malformed link");
  }

  console.log("[auth/callback] Final redirect:", {
    destination,
    redirectUrl: redirectUrl.toString(),
    origin: requestUrl.origin,
  });

  return NextResponse.redirect(redirectUrl.toString());
}
