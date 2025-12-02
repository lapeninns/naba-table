import { NextResponse } from "next/server";
import { z } from "zod";

import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";
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

type CallbackUrlOptions = {
  hostHeader: string;
  rootDomain: string;
  absoluteRedirect: string;
};

function buildCallbackUrl({ hostHeader, rootDomain, absoluteRedirect }: CallbackUrlOptions) {
  const defaultProtocol = hostHeader.includes("localhost") || hostHeader.startsWith("127.") ? "http" : "https";

  const resolveBase = () => {
    if (hostHeader) return `${defaultProtocol}://${hostHeader}`;
    const normalizedRoot = rootDomain.startsWith("www.") ? rootDomain : `www.${rootDomain}`;
    return `https://${normalizedRoot}`;
  };

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(absoluteRedirect, resolveBase());
  } catch {
    redirectUrl = new URL("/", resolveBase());
  }

  const redirectHostname = redirectUrl.hostname;
  const redirectHostWithPort = redirectUrl.host;
  const redirectProtocol = redirectUrl.protocol && redirectUrl.protocol !== ":" ? redirectUrl.protocol.replace(":", "") : defaultProtocol;

  // Ensure callback host stays within our allowed domain/localhost set
  const isLocal = redirectHostname.includes("localhost") || redirectHostname.startsWith("127.");
  const isValidDomain = redirectHostname === rootDomain || redirectHostname.endsWith(`.${rootDomain}`);

  let finalHost = redirectHostWithPort;
  let finalProtocol = redirectProtocol;

  if (!isLocal && !isValidDomain) {
    console.warn(`[Auth] Invalid hostname '${redirectHostWithPort}' detected for callback. Falling back to '${rootDomain}'`);
    const normalizedRoot = rootDomain.startsWith("www.") ? rootDomain : `www.${rootDomain}`;
    finalHost = normalizedRoot;
    finalProtocol = "https";
  }

  const url = new URL("/api/auth/callback", `${finalProtocol}://${finalHost}`);
  const redirectedFromParam = redirectUrl.toString();
  url.searchParams.set("redirectedFrom", redirectedFromParam);

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
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: "Invalid or missing CSRF token" }, { status: 403 });
  }

  const rawHost = req.headers.get("host") ?? req.nextUrl.host ?? "";
  const hostname = parseHostname(req);
  const hostHeader = rawHost.toLowerCase() || hostname;
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
  const protocolForHost = hostHeader.includes("localhost") || hostHeader.startsWith("127.") ? "http" : "https";
  const absoluteRedirectUrl = (() => {
    try {
      return new URL(absoluteRedirect);
    } catch {
      return new URL(absoluteRedirect, `${protocolForHost}://${hostHeader}`);
    }
  })();

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

  const emailRedirectTo = buildCallbackUrl({
    hostHeader,
    rootDomain,
    absoluteRedirect: absoluteRedirectUrl.toString(),
  });
  console.log("[Auth/signin] Magic link details:", {
    hostname,
    hostHeader,
    rootDomain,
    redirectTarget,
    absoluteRedirect: absoluteRedirectUrl.toString(),
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
