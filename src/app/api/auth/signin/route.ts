import { NextResponse } from "next/server";
import { z } from "zod";

import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { validatePasswordStrength } from "@/lib/security/passwordPolicy";
import { validateCsrfToken } from "@/server/security/csrf";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    mode: z.enum(["password", "magic_link"]),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").transform((value) => value.toLowerCase()),
    password: z.string().trim().optional(),
    redirectedFrom: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "password") {
      const result = validatePasswordStrength(data.password);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: result.error,
        });
      }
    }
  });

const RATE_LIMITS = {
  password: { limit: 5, windowMs: 5 * 60 * 1000 },
  magic_link: { limit: 5, windowMs: 10 * 60 * 1000 },
} as const;

function buildCallbackUrl(hostname: string, redirectedFrom: string | undefined) {
  let validHostname = hostname;

  // Ensure hostname is one of our allowed public domains
  // This prevents issues where the server sees an internal IP (e.g. AWS/Vercel internal IP) as the host
  const isLocal = hostname.includes("localhost");
  const isValidDomain = hostname.endsWith("nabatable.com");

  if (!isLocal && !isValidDomain) {
    console.warn(`[Auth] Invalid hostname '${hostname}' detected. Falling back to 'nabatable.com'`);
    validHostname = "nabatable.com";
  }

  // Normalize to naked domain to match Supabase wildcard (https://nabatable.com/**)
  if (validHostname.startsWith("www.")) {
    validHostname = validHostname.replace("www.", "");
  }

  const protocol = validHostname.includes("localhost") ? "http" : "https";
  const url = new URL("/api/auth/callback", `${protocol}://${validHostname}`);

  if (redirectedFrom) {
    url.searchParams.set("redirectedFrom", redirectedFrom);
  }
  return url.toString();
}

function buildRateLimitId(req: NextRequest, email: string, mode: "password" | "magic_link") {
  const realIp = req.headers.get("x-real-ip")?.trim();
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp ?? forwardedFor ?? "unknown";
  return `auth:${mode}:${ip}:${email}`;
}

function setRateHeaders(response: NextResponse, limitResult: Awaited<ReturnType<typeof consumeRateLimit>>) {
  response.headers.set("X-RateLimit-Limit", limitResult.limit.toString());
  response.headers.set("X-RateLimit-Remaining", limitResult.remaining.toString());
  response.headers.set("X-RateLimit-Reset", limitResult.resetAt.toString());
  return response;
}

function isSignupDisabledError(error: { message?: string | null; code?: string | null }) {
  const message = (error.message ?? "").toLowerCase();
  return error.code === "signup_disabled" || message.includes("signups not allowed for otp");
}

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: "Invalid or missing CSRF token" }, { status: 403 });
  }

  const hostname = parseHostname(req);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const validated = requestSchema.safeParse(parsedBody);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return NextResponse.json(
      { message: issue.message, details: { field: issue.path[0] ?? undefined } },
      { status: 400 },
    );
  }

  const { email, password, mode, redirectedFrom } = validated.data;
  const redirectTarget = sanitizeRedirect(redirectedFrom, rootDomain) ?? defaultRedirectForHost(hostname, rootDomain);
  const absoluteRedirect = toAbsoluteRedirectTarget(redirectTarget, rootDomain);

  const rateResult = await consumeRateLimit({
    identifier: buildRateLimitId(req, email, mode),
    limit: RATE_LIMITS[mode].limit,
    windowMs: RATE_LIMITS[mode].windowMs,
  });

  if (!rateResult.ok) {
    const retryAfter = Math.max(1, Math.ceil((rateResult.resetAt - Date.now()) / 1000));
    const response = NextResponse.json({ message: "Too many attempts. Please try again later." }, { status: 429 });
    response.headers.set("Retry-After", retryAfter.toString());
    return setRateHeaders(response, rateResult);
  }

  const supabase = await getRouteHandlerSupabaseClient();

  if (mode === "password") {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: password!,
    });

    if (error) {
      const status = error.status ?? 401;
      const message = status === 401 || status === 400 ? "Invalid email or password" : error.message;
      const response = NextResponse.json({ message }, { status: status === 400 ? 401 : status });
      return setRateHeaders(response, rateResult);
    }

    const response = NextResponse.json({ status: "ok", redirectTo: redirectTarget });
    return setRateHeaders(response, rateResult);
  }

  const emailRedirectTo = buildCallbackUrl(hostname, absoluteRedirect);
  console.log("[Auth/signin] Magic link details:", {
    hostname,
    rootDomain,
    redirectTarget,
    absoluteRedirect,
    emailRedirectTo,
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (isSignupDisabledError(error)) {
      console.warn("[Auth/signin] signup disabled for otp; retrying with service client", {
        message: error.message,
        code: error.code,
        status: error.status,
      });

      const serviceSupabase = getServiceSupabaseClient();
      const { error: serviceError } = await serviceSupabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
          shouldCreateUser: false,
        },
      });

      if (!serviceError) {
        const response = NextResponse.json({ status: "magic_link_sent", redirectTo: absoluteRedirect }, { status: 202 });
        return setRateHeaders(response, rateResult);
      }

      const fallbackStatus = serviceError.status ?? 400;
      const fallbackMessage =
        serviceError.code === "user_not_found"
          ? "No account found for that email. Please sign up instead."
          : serviceError.message ?? "We couldn’t send a magic link right now. Please try again shortly.";

      const response = NextResponse.json({ message: fallbackMessage }, { status: fallbackStatus });
      return setRateHeaders(response, rateResult);
    }

    const status = error.status ?? 400;
    const response = NextResponse.json(
      { message: error.message ?? "We couldn’t send a magic link right now. Please try again shortly." },
      { status },
    );
    return setRateHeaders(response, rateResult);
  }

  const response = NextResponse.json({ status: "magic_link_sent", redirectTo: absoluteRedirect }, { status: 202 });
  return setRateHeaders(response, rateResult);
}
