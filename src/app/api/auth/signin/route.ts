import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { env } from "@/lib/env";
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

function buildCallbackUrl(host: string, redirectedFrom: string | undefined) {
  let validHost = host;

  // Extract hostname without port for domain validation
  const hostnameOnly = host.split(":")[0];
  
  // Ensure hostname is one of our allowed public domains
  // This prevents issues where the server sees an internal IP (e.g. AWS/Vercel internal IP) as the host
  const isLocal = hostnameOnly.includes("localhost") || hostnameOnly.startsWith("127.");
  const isValidDomain = hostnameOnly.endsWith("nabatable.com");

  if (!isLocal && !isValidDomain) {
    console.warn(`[Auth] Invalid hostname '${host}' detected. Falling back to 'nabatable.com'`);
    validHost = "nabatable.com";
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
  return `auth:${mode}:${ip}:${email}`;
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

    // Get full host header (includes port in dev, e.g., "localhost:3000")
    const hostHeader = req.headers.get("host") ?? req.nextUrl.host ?? "localhost:3000";
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

  const emailRedirectTo = buildCallbackUrl(hostHeader, absoluteRedirect);
  console.log("[Auth/signin] Magic link details:", {
    hostname,
    hostHeader,
    rootDomain,
    redirectTarget,
    absoluteRedirect,
    emailRedirectTo,
  });

  // Use Resend directly if configured, to bypass Supabase email limits/issues
  if (env.resend.apiKey && env.resend.from) {
    try {
      // Generate PKCE pair to support code exchange flow
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");

      const adminSupabase = getServiceSupabaseClient();
      const { data, error: generateError } = await adminSupabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: emailRedirectTo,
          redirect_to: emailRedirectTo,
          code_challenge: challenge,
          code_challenge_method: "s256",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      if (generateError) {
        throw generateError;
      }

      const magicLink = data.properties?.action_link;
      if (!magicLink) {
        throw new Error("Failed to generate magic link");
      }

      // Manually set the PKCE verifier cookie so exchangeCodeForSession works
      const cookieStore = await cookies();
      const url = new URL(env.supabase.url);
      const projectId = url.hostname.split(".")[0];
      const cookieName = `sb-${projectId}-auth-token-code-verifier`;
      
      cookieStore.set({
        name: cookieName,
        value: verifier,
        httpOnly: true,
        secure: env.node.appEnv !== "development",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10, // 10 minutes
        domain: rootDomain !== "localhost" ? `.${rootDomain}` : undefined,
      });

      const resend = new Resend(env.resend.apiKey);
      const { error: emailError } = await resend.emails.send({
        from: env.resend.from,
        to: email,
        subject: "Sign in to Nab a Table",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Sign in to Nab a Table</h2>
            <p>Click the button below to sign in to your account.</p>
            <a href="${magicLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Sign In</a>
            <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
          </div>
        `,
      });

      if (emailError) {
        console.error("[Auth/signin] Resend error:", emailError);
        throw new Error("Failed to send email via Resend");
      }

      const response = NextResponse.json({ status: "magic_link_sent", redirectTo: absoluteRedirect }, { status: 202 });
      return setRateHeaders(response, rateResult);

    } catch (err) {
      console.error("[Auth/signin] Manual magic link failed, falling back to Supabase:", err);
      // Fall through to default Supabase behavior if manual sending fails
    }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  console.log("[Auth/signin] OTP result:", { error: error?.message, status: error?.status });

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
    console.error("[Auth/signin] Unhandled error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
