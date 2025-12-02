import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { env } from "@/lib/env";
import { CSRF_COOKIE_NAME } from "@/lib/security/csrf";
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
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const isLocal = hostname.includes("localhost");
  const domain = isLocal ? hostname : rootDomain.replace(/^www\./, "");
  const protocol = isLocal ? "http" : "https";
  const url = new URL("/api/auth/callback", `${protocol}://${domain}`);
  if (redirectedFrom) {
    url.searchParams.set("redirectedFrom", redirectedFrom);
  }
  return url.toString();
}

function buildRateLimitId(req: NextRequest, email: string, mode: "password" | "magic_link") {
  const realIp = req.headers.get("x-real-ip")?.trim();
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp ?? forwardedFor ?? "unknown";
  return `auth-signup:${mode}:${ip}:${email}`;
}

function setRateHeaders(response: NextResponse, limitResult: Awaited<ReturnType<typeof consumeRateLimit>>) {
  response.headers.set("X-RateLimit-Limit", limitResult.limit.toString());
  response.headers.set("X-RateLimit-Remaining", limitResult.remaining.toString());
  response.headers.set("X-RateLimit-Reset", limitResult.resetAt.toString());
  return response;
}

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: "Invalid or missing CSRF token" }, { status: 403 });
  }

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
  const hostname = parseHostname(req);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const redirectTarget = sanitizeRedirect(redirectedFrom, rootDomain) ?? "/onboarding/profile";
  const absoluteRedirect = toAbsoluteRedirectTarget(redirectTarget, rootDomain);
  const callbackUrl = buildCallbackUrl(hostname, absoluteRedirect);

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password: password!,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      const status = error.status ?? 400;
      const message = status === 400 || status === 409 ? error.message ?? "Signup failed" : "Signup failed";
      const response = NextResponse.json({ message }, { status });
      return setRateHeaders(response, rateResult);
    }

    if (!data.session && data.user && env.node.appEnv === "development") {
      try {
        const serviceClient = getServiceSupabaseClient();
        if (serviceClient) {
          await serviceClient.auth.admin.updateUserById(data.user.id, { email_confirm: true });
          await supabase.auth.signInWithPassword({
            email,
            password: password!,
          });
        }
      } catch (err) {
        console.error("Failed to auto-confirm user in dev:", err);
      }
    }

    const cookieStore = await cookies();

    const response = NextResponse.json({ status: "ok", redirectTo: redirectTarget });

    // Explicitly copy cookies from the store to the response to ensure they are sent
    cookieStore.getAll().forEach((cookie) => {
      if (cookie.name === CSRF_COOKIE_NAME) return;
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        path: '/',
        secure: env.node.appEnv !== 'development',
        httpOnly: true,
        sameSite: 'lax',
      });
    });

    return setRateHeaders(response, rateResult);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
      shouldCreateUser: true,
    },
  });

  if (error) {
    const status = error.status ?? 400;
    const response = NextResponse.json(
      { message: error.message ?? "We couldn’t send a magic link right now. Please try again shortly." },
      { status },
    );
    return setRateHeaders(response, rateResult);
  }

  const response = NextResponse.json({ status: "magic_link_sent", redirectTo: redirectTarget }, { status: 202 });
  return setRateHeaders(response, rateResult);
}
