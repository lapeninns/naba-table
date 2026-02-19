import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  defaultRedirectForHost,
  parseHostname,
  sanitizeRedirect,
  toAbsoluteRedirectTarget,
} from '@/lib/auth/redirects';
import {
  isMagicLinkDeliveryError,
  sendAuthMagicLink,
} from '@/server/auth/magic-link-email';
import { recordMagicLinkSigninAudit } from '@/server/auth/signin-audit';
import { classifySigninSurface } from '@/server/auth/signin-surface';
import { consumeMagicLinkSigninThrottle } from '@/server/auth/signin-throttle';
import { normalizeEmail } from '@/server/customers';
import { validateCsrfToken } from '@/server/security/csrf';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { extractClientIp } from '@/server/security/request';
import { verifyTurnstileToken } from '@/server/security/turnstile';
import {
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
} from '@/server/supabase';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const requestSchema = z
  .object({
    mode: z.enum(['password', 'magic_link']),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email address')
      .transform((value) => value.toLowerCase()),
    password: z.string().trim().optional(),
    redirectedFrom: z.string().optional(),
    rememberMe: z.boolean().optional().default(true),
    captchaToken: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'password' && !data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Enter your password',
      });
    }
  });

const PASSWORD_RATE_LIMIT = { limit: 5, windowMs: 5 * 60 * 1000 } as const;
const GUEST_MAGIC_LINK_TURNSTILE_ACTION = 'guest_signin_magic_link';

type MagicLinkLookupStatus = 'found' | 'not_found' | 'error';

function buildCallbackUrl(
  hostname: string,
  redirectedFrom: string | undefined,
  rememberMe: boolean,
  pathname: string = '/api/auth/callback',
) {
  let validHostname = hostname;

  const isLocal = hostname.includes('localhost');
  const isValidDomain = hostname.endsWith('nabatable.com');

  if (!isLocal && !isValidDomain) {
    console.warn(
      `[Auth] Invalid hostname '${hostname}' detected. Falling back to 'nabatable.com'`,
    );
    validHostname = 'nabatable.com';
  }

  if (isLocal) {
    validHostname = hostname.includes(':') ? hostname : `${hostname}:3000`;
  }

  const protocol = validHostname.includes('localhost') ? 'http' : 'https';
  const url = new URL(pathname, `${protocol}://${validHostname}`);

  if (redirectedFrom) {
    url.searchParams.set('redirectedFrom', redirectedFrom);
  }
  url.searchParams.set('rememberMe', rememberMe ? '1' : '0');
  return url.toString();
}

function buildPasswordRateLimitId(req: NextRequest, email: string) {
  const realIp = req.headers.get('x-real-ip')?.trim();
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = realIp ?? forwardedFor ?? 'unknown';
  return `auth:password:${ip}:${email}`;
}

function setRateHeaders(
  response: NextResponse,
  limitResult: Awaited<ReturnType<typeof consumeRateLimit>>,
) {
  response.headers.set('X-RateLimit-Limit', limitResult.limit.toString());
  response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', limitResult.resetAt.toString());
  return response;
}

function resolveRetryAfter(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

async function lookupMagicLinkProfile(email: string): Promise<MagicLinkLookupStatus> {
  const serviceSupabase = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await serviceSupabase
    .from('user_profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[Auth/signin] Failed to lookup user profile for magic link', {
      error: error.message,
    });
    return 'error';
  }

  return data?.id ? 'found' : 'not_found';
}

export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfToken(req)) {
      return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const hostname = parseHostname(req);
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';

    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const validated = requestSchema.safeParse(parsedBody);
    if (!validated.success) {
      const issue = validated.error.issues[0];
      return NextResponse.json(
        { message: issue.message, details: { field: issue.path[0] ?? undefined } },
        { status: 400 },
      );
    }

    const { email, password, mode, redirectedFrom, rememberMe, captchaToken } =
      validated.data;
    const redirectTarget =
      sanitizeRedirect(redirectedFrom, rootDomain, hostname) ??
      defaultRedirectForHost(hostname, rootDomain);
    const absoluteRedirect = toAbsoluteRedirectTarget(redirectTarget, rootDomain);

    if (mode === 'password') {
      const rateResult = await consumeRateLimit({
        identifier: buildPasswordRateLimitId(req, email),
        limit: PASSWORD_RATE_LIMIT.limit,
        windowMs: PASSWORD_RATE_LIMIT.windowMs,
      });

      if (!rateResult.ok) {
        const response = NextResponse.json(
          { message: 'Too many attempts. Please try again later.' },
          { status: 429 },
        );
        response.headers.set('Retry-After', resolveRetryAfter(rateResult.resetAt).toString());
        return setRateHeaders(response, rateResult);
      }

      const supabase = await getRouteHandlerSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: password!,
      });

      if (error) {
        const status = error.status ?? 401;
        const message =
          status === 401 || status === 400 ? 'Invalid email or password' : error.message;
        const response = NextResponse.json(
          { message },
          { status: status === 400 ? 401 : status },
        );
        return setRateHeaders(response, rateResult);
      }

      const response = NextResponse.json({ status: 'ok', redirectTo: redirectTarget });
      return setRateHeaders(response, rateResult);
    }

    const clientIp = extractClientIp(req);
    const userAgent = req.headers.get('user-agent');
    const surface = classifySigninSurface(hostname, rootDomain);
    const throttleResult = await consumeMagicLinkSigninThrottle({ clientIp });
    const primaryRateResult =
      throttleResult.checks.find((check) => check.scope === 'ip')?.result ??
      throttleResult.checks[0]?.result;

    if (!primaryRateResult) {
      return NextResponse.json(
        { message: 'Unable to process request right now.' },
        { status: 503 },
      );
    }

    if (!throttleResult.ok) {
      const blockedScope = throttleResult.blocked.scope;
      await recordMagicLinkSigninAudit({
        email,
        clientIp,
        userAgent,
        surface,
        redirectedFrom,
        outcome:
          blockedScope === 'ip'
            ? 'blocked_rate_limit_ip'
            : 'blocked_rate_limit_global',
        throttleScope: blockedScope,
        throttleLimit: throttleResult.blocked.result.limit,
        throttleRemaining: throttleResult.blocked.result.remaining,
        throttleResetAt: throttleResult.blocked.result.resetAt,
      });

      const response = NextResponse.json(
        { message: 'Too many attempts. Please try again later.' },
        { status: 429 },
      );
      response.headers.set(
        'Retry-After',
        resolveRetryAfter(throttleResult.blocked.result.resetAt).toString(),
      );
      response.headers.set('X-RateLimit-Scope', blockedScope);
      return setRateHeaders(response, throttleResult.blocked.result);
    }

    if (surface === 'public_guest') {
      if (!captchaToken) {
        await recordMagicLinkSigninAudit({
          email,
          clientIp,
          userAgent,
          surface,
          redirectedFrom,
          outcome: 'blocked_captcha_missing',
          throttleScope: 'ip',
          throttleLimit: primaryRateResult.limit,
          throttleRemaining: primaryRateResult.remaining,
          throttleResetAt: primaryRateResult.resetAt,
        });

        const response = NextResponse.json(
          {
            message: 'Complete verification and try again.',
            code: 'CAPTCHA_REQUIRED',
          },
          { status: 403 },
        );
        return setRateHeaders(response, primaryRateResult);
      }

      const captchaResult = await verifyTurnstileToken({
        token: captchaToken,
        remoteIp: clientIp,
        expectedAction: GUEST_MAGIC_LINK_TURNSTILE_ACTION,
      });

      if (!captchaResult.ok) {
        const captchaOutcome =
          captchaResult.reason === 'verify_unavailable' ||
          captchaResult.reason === 'missing_secret'
            ? 'captcha_verify_unavailable'
            : 'blocked_captcha_invalid';

        await recordMagicLinkSigninAudit({
          email,
          clientIp,
          userAgent,
          surface,
          redirectedFrom,
          outcome: captchaOutcome,
          throttleScope: 'ip',
          throttleLimit: primaryRateResult.limit,
          throttleRemaining: primaryRateResult.remaining,
          throttleResetAt: primaryRateResult.resetAt,
          captchaErrorCodes: captchaResult.errorCodes,
        });

        const response = NextResponse.json(
          {
            message: 'Verification failed. Please try again.',
            code: 'CAPTCHA_INVALID',
            details: { reason: captchaResult.reason },
          },
          { status: 403 },
        );
        return setRateHeaders(response, primaryRateResult);
      }
    }

    const lookupStatus = await lookupMagicLinkProfile(email);
    if (lookupStatus !== 'found') {
      await recordMagicLinkSigninAudit({
        email,
        clientIp,
        userAgent,
        surface,
        redirectedFrom,
        outcome:
          lookupStatus === 'not_found' ? 'suppressed_unknown_email' : 'lookup_error',
        throttleScope: 'ip',
        throttleLimit: primaryRateResult.limit,
        throttleRemaining: primaryRateResult.remaining,
        throttleResetAt: primaryRateResult.resetAt,
      });

      const response = NextResponse.json(
        { status: 'magic_link_sent', redirectTo: absoluteRedirect },
        { status: 202 },
      );
      return setRateHeaders(response, primaryRateResult);
    }

    const emailRedirectTo = buildCallbackUrl(hostname, absoluteRedirect, rememberMe);
    console.log('[Auth/signin] Magic link details:', {
      hostname,
      rootDomain,
      redirectTarget,
      absoluteRedirect,
      emailRedirectTo,
      surface,
    });

    try {
      await sendAuthMagicLink({
        email,
        emailRedirectTo,
        intent: 'signin',
      });
    } catch (error) {
      const sendErrorReason =
        error instanceof Error ? error.message : String(error);

      console.error('[Auth/signin] Magic link delivery failed', {
        status: isMagicLinkDeliveryError(error) ? error.status : undefined,
        error: sendErrorReason,
      });

      await recordMagicLinkSigninAudit({
        email,
        clientIp,
        userAgent,
        surface,
        redirectedFrom,
        outcome: 'send_error',
        sendErrorReason,
        throttleScope: 'ip',
        throttleLimit: primaryRateResult.limit,
        throttleRemaining: primaryRateResult.remaining,
        throttleResetAt: primaryRateResult.resetAt,
      });

      const response = NextResponse.json(
        { status: 'magic_link_sent', redirectTo: absoluteRedirect },
        { status: 202 },
      );
      return setRateHeaders(response, primaryRateResult);
    }

    await recordMagicLinkSigninAudit({
      email,
      clientIp,
      userAgent,
      surface,
      redirectedFrom,
      outcome: 'sent',
      throttleScope: 'ip',
      throttleLimit: primaryRateResult.limit,
      throttleRemaining: primaryRateResult.remaining,
      throttleResetAt: primaryRateResult.resetAt,
    });

    const response = NextResponse.json(
      { status: 'magic_link_sent', redirectTo: absoluteRedirect },
      { status: 202 },
    );
    return setRateHeaders(response, primaryRateResult);
  } catch (err) {
    console.error('[Auth/signin] Unhandled error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
