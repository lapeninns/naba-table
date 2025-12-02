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
  // For localhost, ensure we include the port (default 3000 for Next.js dev)
  const hostWithPort = isLocal && !validHostname.includes(":") ? `${validHostname}:3000` : validHostname;
  const url = new URL("/api/auth/callback", `${protocol}://${hostWithPort}`);

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

function buildMagicLinkEmailHtml(actionLink: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Sign in to Nab a Table</h1>
      <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
        Click the button below to sign in to your account. This link will expire in 1 hour.
      </p>
      <a href="${actionLink}" 
         style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; 
                text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
        Sign in to Nab a Table
      </a>
      <p style="color: #999; font-size: 14px; margin-top: 30px;">
        If you didn't request this email, you can safely ignore it.
      </p>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${actionLink}" style="color: #666; word-break: break-all;">
          ${actionLink}
        </a>
      </p>
    </div>
  `;
}

function buildMagicLinkEmailText(actionLink: string): string {
  return `Sign in to Nab a Table

Click the link below to sign in to your account. This link will expire in 1 hour.

${actionLink}

If you didn't request this email, you can safely ignore it.`;
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

  // Use admin.generateLink to generate magic link and send via our own email provider (Resend)
  // This bypasses Supabase's email sending which requires SMTP configuration
  const serviceSupabase = getServiceSupabaseClient();
  
  // Try to create the user. If they already exist, createUser will fail but that's okay.
  // This is more reliable than trying to check if they exist first.
  const { error: createError } = await serviceSupabase.auth.admin.createUser({
    email,
    email_confirm: false, // Don't auto-confirm, let them click the magic link
  });
  
  // Only log an error if it's not "already registered"
  if (createError && !createError.message?.includes("already registered")) {
    console.error("[Auth/signin] Failed to create user:", createError);
    const response = NextResponse.json(
      { message: "We couldn't process your sign in request. Please try again." },
      { status: 500 }
    );
    return setRateHeaders(response, rateResult);
  }
  
  if (!createError) {
    console.log("[Auth/signin] Created new user for:", email);
  }

  // Generate magic link using admin API
  const { data: linkData, error: linkError } = await serviceSupabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: emailRedirectTo,
    },
  });

  if (linkError) {
    console.error("[Auth/signin] Failed to generate magic link:", linkError);
    const response = NextResponse.json(
      { message: linkError.message ?? "We couldn't send a magic link right now. Please try again shortly." },
      { status: linkError.status ?? 500 }
    );
    return setRateHeaders(response, rateResult);
  }

  if (!linkData?.properties?.action_link) {
    console.error("[Auth/signin] No action link in response");
    const response = NextResponse.json(
      { message: "We couldn't generate a magic link. Please try again shortly." },
      { status: 500 }
    );
    return setRateHeaders(response, rateResult);
  }

  // Send the magic link email via Resend
  try {
    await sendEmail({
      to: email,
      subject: "Sign in to Nab a Table",
      fromName: "Nab a Table",
      html: buildMagicLinkEmailHtml(linkData.properties.action_link),
      text: buildMagicLinkEmailText(linkData.properties.action_link),
    });

    console.log("[Auth/signin] Magic link email sent successfully to:", email);
  } catch (emailError) {
    console.error("[Auth/signin] Failed to send magic link email:", emailError);
    const response = NextResponse.json(
      { message: "We couldn't send the magic link email. Please try again shortly." },
      { status: 500 }
    );
    return setRateHeaders(response, rateResult);
  }

  const response = NextResponse.json({ status: "magic_link_sent", redirectTo: absoluteRedirect }, { status: 202 });
  return setRateHeaders(response, rateResult);
}
