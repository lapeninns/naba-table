import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  fieldsFromIssues,
  forbidden,
  internalError,
  rateLimited,
} from '@/lib/api/errors';
import { buildAuthCallbackUrl, parseHostname } from '@/lib/auth/redirects';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { validatePasswordStrength } from '@/lib/security/passwordPolicy';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';
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
const SIGNUP_REDIRECT_PREFIXES = ['/onboarding'] as const;

function sanitizeRedirect(target: string | undefined) {
  const sanitized = sanitizeLocalRedirectPath(target, {
    fallback: '',
    allowedPrefixes: SIGNUP_REDIRECT_PREFIXES,
  });
  return sanitized || undefined;
}

function buildSignupCallbackUrl(req: NextRequest, redirectedFrom: string | undefined) {
  return buildAuthCallbackUrl({
    hostname: parseHostname(req),
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'nabatable.com',
    redirectedFrom,
    rememberMe: false,
  });
}

function buildRateLimitId(req: NextRequest, email: string, mode: SignupMode) {
  const ip = extractClientIp(req);
  return `signup:${mode}:${ip}:${email}`;
}

function buildAggregateRateLimitId(req: NextRequest, mode: SignupMode) {
  const ip = extractClientIp(req);
  return `signup:${mode}:${ip}`;
}

function isExistingAccountError(error: { message?: string | null }) {
  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('already exists')
  );
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

function rateLimitedResponse(limitResult: Awaited<ReturnType<typeof consumeRateLimit>>) {
  const retryAfter = Math.max(1, Math.ceil((limitResult.resetAt - Date.now()) / 1000));
  return rateLimited(retryAfter, 'Too many attempts. Please try again later.');
}

type SignupProviderError = { message?: string | null; status?: number; code?: string };

/** Maps a provider sign-up failure to safe copy; provider text never reaches the client. */
function passwordSignupFailure(error: SignupProviderError) {
  if (error.status === 429) {
    return rateLimited(60, 'Too many attempts. Please try again later.');
  }
  if (error.code === 'weak_password') {
    return apiError(400, 'WEAK_PASSWORD', 'Choose a stronger password.', {
      fields: { password: ['Choose a stronger password.'] },
    });
  }
  if (typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    return apiError(
      400,
      'SIGNUP_FAILED',
      "We couldn't create your account. Check your details and try again.",
    );
  }
  return internalError(error, { route: 'auth.signup', mode: 'password' });
}

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return forbidden(
      'CSRF_INVALID',
      'Your session token is out of date. Refresh the page and try again.',
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const validated = requestSchema.safeParse(parsedBody);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return apiError(400, 'VALIDATION_FAILED', issue?.message ?? 'Some fields need attention.', {
      fields: fieldsFromIssues(validated.error.issues),
      details: { field: issue?.path[0] ?? undefined },
    });
  }

  const { email, password, mode } = validated.data;
  const redirectedFrom = sanitizeRedirect(validated.data.redirectedFrom) ?? DEFAULT_REDIRECT;

  const aggregateRateResult = await consumeRateLimit({
    identifier: buildAggregateRateLimitId(req, mode),
    limit: mode === 'password' ? 20 : 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!aggregateRateResult.ok) {
    return setRateHeaders(rateLimitedResponse(aggregateRateResult), aggregateRateResult);
  }

  const rateResult = await consumeRateLimit({
    identifier: buildRateLimitId(req, email, mode),
    limit: mode === 'password' ? 5 : 8,
    windowMs: mode === 'password' ? 5 * 60 * 1000 : 10 * 60 * 1000,
  });

  if (!rateResult.ok) {
    return setRateHeaders(rateLimitedResponse(rateResult), rateResult);
  }

  const supabase = await getRouteHandlerSupabaseClient();

  if (mode === 'password') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: password!,
      options: { emailRedirectTo: buildSignupCallbackUrl(req, redirectedFrom) },
    });

    if (error) {
      const response = isExistingAccountError(error)
        ? NextResponse.json(
            {
              status: 'confirmation_required',
              redirectTo: redirectedFrom,
            },
            { status: 201 },
          )
        : passwordSignupFailure(error);
      return setRateHeaders(response, rateResult);
    }

    const response = NextResponse.json(
      { status: data.session ? 'ok' : 'confirmation_required', redirectTo: redirectedFrom },
      { status: 201 },
    );
    return setRateHeaders(response, rateResult);
  }

  const emailRedirectTo = buildSignupCallbackUrl(req, redirectedFrom);
  try {
    await sendAuthMagicLink({
      email,
      emailRedirectTo,
      intent: 'signup',
      data: { intent: 'onboarding_signup' },
    });
  } catch (error) {
    logger.warn('auth.signup.magic_link_failed', {
      status: isMagicLinkDeliveryError(error) ? error.status : undefined,
    });
    captureServerException(error, {
      properties: { source: 'auth', kind: 'signup' },
    });

    const failure = getMagicLinkFailure(
      error,
      'We could not send a magic link right now. Please try again.',
    );
    const response =
      failure.status >= 500
        ? apiError(502, 'MAGIC_LINK_FAILED', failure.message, { retryable: true })
        : apiError(failure.status, 'MAGIC_LINK_FAILED', failure.message);
    return setRateHeaders(response, rateResult);
  }

  const response = NextResponse.json(
    { status: 'magic_link_sent', redirectTo: redirectedFrom },
    { status: 202 },
  );
  return setRateHeaders(response, rateResult);
}
