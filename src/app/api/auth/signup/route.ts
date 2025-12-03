import { NextResponse } from "next/server";
import { z } from "zod";

import { sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { validatePasswordStrength } from "@/lib/security/passwordPolicy";
import { validateCsrfToken } from "@/server/security/csrf";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

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

function buildCallbackUrl(host: string, redirectedFrom: string | undefined, rootDomain: string) {
  let validHost = host;
  const hostnameOnly = host.split(":")[0];
  const isLocal = hostnameOnly.includes("localhost") || hostnameOnly.startsWith("127.");
  const isValidDomain = rootDomain && hostnameOnly.endsWith(rootDomain);

  if (!isLocal && !isValidDomain) {
    console.warn(`[Auth] Invalid hostname '${host}' detected. Falling back to '${rootDomain || "localhost"}'`);
    validHost = rootDomain || "localhost";
  }

  const protocol = isLocal ? "http" : "https";
  const url = new URL("/api/auth/callback", `${protocol}://${validHost}`);
  if (redirectedFrom) {
    url.searchParams.set("redirectedFrom", redirectedFrom);
  }
  return url.toString();
}

function buildRateLimitId(req: NextRequest, email: string, mode: "password" | "magic_link") {
  const realIp = req.headers.get("x-real-ip")?.trim();
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp ?? forwardedFor ?? "unknown";
  return `auth:signup:${mode}:${ip}:${email}`;
}

function setRateHeaders(response: NextResponse, limitResult: Awaited<ReturnType<typeof consumeRateLimit>>) {
  response.headers.set("X-RateLimit-Limit", limitResult.limit.toString());
  response.headers.set("X-RateLimit-Remaining", limitResult.remaining.toString());
  response.headers.set("X-RateLimit-Reset", limitResult.resetAt.toString());
  return response;
}

export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfToken(req)) {
      return NextResponse.json({ message: "Invalid or missing CSRF token" }, { status: 403 });
    }

    const hostHeader = req.headers.get("host") ?? req.nextUrl.host ?? "localhost:3000";
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
    const redirectTarget = sanitizeRedirect(redirectedFrom, rootDomain) ?? "/onboarding/profile";
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
    const emailRedirectTo = buildCallbackUrl(hostHeader, absoluteRedirect, rootDomain);

    if (mode === "password") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password!,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        const status = error.status ?? 400;
        const response = NextResponse.json(
          { message: error.message ?? "Signup failed. Please try again." },
          { status },
        );
        return setRateHeaders(response, rateResult);
      }

      const response = NextResponse.json({ status: "ok", redirectTo: redirectTarget, userId: data.user?.id });
      return setRateHeaders(response, rateResult);
    }

    // Magic link signup - use Supabase's built-in signInWithOtp for proper PKCE flow
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      const status = error.status ?? 400;
      const response = NextResponse.json(
        { message: error.message ?? "We couldn't send a magic link right now. Please try again shortly." },
        { status },
      );
      return setRateHeaders(response, rateResult);
    }

    const response = NextResponse.json({ status: "magic_link_sent", redirectTo: absoluteRedirect }, { status: 202 });
    return setRateHeaders(response, rateResult);
  } catch (err) {
    console.error("[Auth/signup] Unhandled error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
