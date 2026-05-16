import { NextResponse } from 'next/server';
import { z } from 'zod';

import { validatePasswordStrength } from '@/lib/security/passwordPolicy';
import {
  getMagicLinkFailure,
  isMagicLinkDeliveryError,
  sendAuthMagicLink,
} from '@/server/auth/magic-link-email';
import { validateCsrfToken } from '@/server/security/csrf';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { extractClientIp } from '@/server/security/request';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type SignupMode = 'password' | 'magic_link';

const requestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email')
      .transform((v) => v.toLowerCase()),
    password: z.string().trim().optional(),
    mode: z.enum(['password', 'magic_link']).default('magic_link'),
    redirectedFrom: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'password') {
      const result = validatePasswordStrength(data.password);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: result.error });
      }
    }
  });

const DEFAULT_REDIRECT = '/onboarding/profile';

function sanitizeRedirect(target: string | undefined) {
  if (!target || !target.startsWith('/')) return undefined;
  return target;
}

function buildCallbackUrl(origin: string, redirectedFrom: string | undefined) {
  const url = new URL('/api/auth/callback', origin);
  if (redirectedFrom) {
    url.searchParams.set('redirectedFrom', redirectedFrom);
  }
  return url.toString();
}

function buildRateLimitId(req: NextRequest, email: string, mode: SignupMode) {
  const ip = extractClientIp(req);
  return `signup:${mode}:${ip}:${email}`;
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

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
  }

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

  const { email, password, mode } = validated.data;
  const redirectedFrom = sanitizeRedirect(validated.data.redirectedFrom) ?? DEFAULT_REDIRECT;

  const rateResult = await consumeRateLimit({
    identifier: buildRateLimitId(req, email, mode),
    limit: mode === 'password' ? 5 : 8,
    windowMs: mode === 'password' ? 5 * 60 * 1000 : 10 * 60 * 1000,
  });

  if (!rateResult.ok) {
    const retryAfter = Math.max(1, Math.ceil((rateResult.resetAt - Date.now()) / 1000));
    const response = NextResponse.json(
      { message: 'Too many attempts. Please try again later.' },
      { status: 429 },
    );
    response.headers.set('Retry-After', retryAfter.toString());
    return setRateHeaders(response, rateResult);
  }

  const supabase = await getRouteHandlerSupabaseClient();

  if (mode === 'password') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: password!,
      options: { emailRedirectTo: buildCallbackUrl(req.nextUrl.origin, redirectedFrom) },
    });

    if (error) {
      const status = error.status ?? 400;
      const response = NextResponse.json(
        { message: error.message ?? 'Unable to create account' },
        { status },
      );
      return setRateHeaders(response, rateResult);
    }

    const response = NextResponse.json(
      { status: data.session ? 'ok' : 'confirmation_required', redirectTo: redirectedFrom },
      { status: 201 },
    );
    return setRateHeaders(response, rateResult);
  }

  const emailRedirectTo = buildCallbackUrl(req.nextUrl.origin, redirectedFrom);
  try {
    await sendAuthMagicLink({
      email,
      emailRedirectTo,
      intent: 'signup',
      data: { intent: 'onboarding_signup' },
    });
  } catch (error) {
    console.error('[Auth/signup] Magic link delivery failed', {
      status: isMagicLinkDeliveryError(error) ? error.status : undefined,
      error: error instanceof Error ? error.message : String(error),
    });

    const failure = getMagicLinkFailure(
      error,
      'We could not send a magic link right now. Please try again.',
    );
    const response = NextResponse.json({ message: failure.message }, { status: failure.status });
    return setRateHeaders(response, rateResult);
  }

  const response = NextResponse.json(
    { status: 'magic_link_sent', redirectTo: redirectedFrom },
    { status: 202 },
  );
  return setRateHeaders(response, rateResult);
}
