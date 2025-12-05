import { NextResponse } from "next/server";
import { z } from "zod";

import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
import { validatePasswordStrength } from "@/lib/security/passwordPolicy";
import { sendEmail } from "@/libs/resend";
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
    rememberMe: z.boolean().optional().default(true),
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

function buildCallbackUrl(
  hostname: string,
  redirectedFrom: string | undefined,
  rememberMe: boolean,
  pathname: string = "/api/auth/callback",
) {
  let validHostname = hostname;

  // Ensure hostname is one of our allowed public domains
  // This prevents issues where the server sees an internal IP (e.g. AWS/Vercel internal IP) as the host
  const isLocal = hostname.includes("localhost");
  const isValidDomain = hostname.endsWith("nabatable.com");

  if (!isLocal && !isValidDomain) {
    console.warn(`[Auth] Invalid hostname '${hostname}' detected. Falling back to 'nabatable.com'`);
    validHostname = "nabatable.com";
  }

  // For local development with production Supabase, we need to use localhost
  // but localhost:3000 must be in Supabase's redirect URL allowlist
  // In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add:
  //   http://localhost:3000/**
  if (isLocal) {
    // Ensure port is included for localhost
    validHostname = hostname.includes(":") ? hostname : `${hostname}:3000`;
  }

  // Normalize to naked domain to match Supabase wildcard (https://nabatable.com/**)
  if (validHostname.startsWith("www.")) {
    validHostname = validHostname.replace("www.", "");
  }

  const protocol = validHostname.includes("localhost") ? "http" : "https";
  const url = new URL(pathname, `${protocol}://${validHostname}`);

  if (redirectedFrom) {
    url.searchParams.set("redirectedFrom", redirectedFrom);
  }
  url.searchParams.set("rememberMe", rememberMe ? "1" : "0");
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

async function sendMagicLinkViaResend(email: string, redirectTo: string) {
  const adminClient = getServiceSupabaseClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  if (error || !data?.properties?.action_link) {
    const normalizedError = error ?? new Error("Missing action link from Supabase admin.generateLink");
    console.error("[Auth/signin] Resend fallback: failed to generate link", {
      error: normalizedError instanceof Error ? normalizedError.message : String(normalizedError),
      status: "status" in normalizedError ? (normalizedError as { status?: number }).status : undefined,
      code: "code" in normalizedError ? (normalizedError as { code?: string }).code : undefined,
    });
    return { ok: false as const, error: normalizedError };
  }

  const actionLink = data.properties.action_link;

  const subject = "Your sign-in link";
  const text = `Sign in with this link: ${actionLink}\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Sign in to your account</h2>
      <p style="margin: 0 0 16px;">Click the button below to complete sign-in.</p>
      <p style="margin: 0 0 20px;">
        <a href="${actionLink}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Sign in</a>
      </p>
      <p style="margin: 0 0 8px;">If the button doesn't work, copy and paste this link:</p>
      <p style="word-break: break-all; margin: 0;">${actionLink}</p>
      <p style="margin: 16px 0 0; color:#475569;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      fromName: "Nab a Table",
    });

    console.log("[Auth/signin] Resend fallback: magic link email sent");
    return { ok: true as const };
  } catch (sendError) {
    console.error("[Auth/signin] Resend fallback: send failed", {
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
    return { ok: false as const, error: sendError };
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const { email, password, mode, redirectedFrom, rememberMe } = validated.data;
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

    const supabase = await getRouteHandlerSupabaseClient(undefined, rememberMe);

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

    const emailRedirectTo = buildCallbackUrl(hostname, absoluteRedirect, rememberMe);
    const implicitFlowRedirectTo = buildCallbackUrl(hostname, absoluteRedirect, rememberMe, "/auth/signin");
    console.log("[Auth/signin] Magic link details:", {
      hostname,
      rootDomain,
      redirectTarget,
      absoluteRedirect,
      emailRedirectTo,
    });

    // Use Supabase's built-in signInWithOtp for proper PKCE flow.
    // If delivery fails (common when SMTP is misconfigured), fall back to generating
    // the link via admin API and sending via Resend.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    console.log("[Auth/signin] OTP result:", { error: error?.message, status: error?.status });

    if (error) {
      const isSendFailure = (error.status ?? 500) >= 500 || /sending/i.test(error.message ?? "");

      if (isSendFailure) {
        console.warn("[Auth/signin] Supabase email delivery failed, attempting Resend fallback", {
          status: error.status,
          message: error.message,
          code: (error as { code?: string }).code,
        });

        const fallback = await sendMagicLinkViaResend(email, implicitFlowRedirectTo);
        if (fallback.ok) {
          const response = NextResponse.json(
            { status: "magic_link_sent", redirectTo: absoluteRedirect, delivery: "resend_fallback" },
            { status: 202 },
          );
          return setRateHeaders(response, rateResult);
        }
      }

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
