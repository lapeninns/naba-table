export type RateLimitResponseSpec<TBody> = {
  body: TBody;
  init: {
    status: 429;
    headers: Record<string, string>;
  };
};

export type BookingRateLimitResult = {
  resetAt: number;
  limit: number;
  remaining: number;
};

export function calculateRetryAfterSeconds(resetAt: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

export function buildGuestLookupRateLimitResponse<TAccess>(params: {
  rateLimit: Pick<BookingRateLimitResult, 'resetAt'>;
  access: TAccess;
  now?: number;
}): RateLimitResponseSpec<{
  error: 'Too many requests';
  code: 'RATE_LIMITED';
  retryAfter: number;
  access: TAccess;
}> {
  const retryAfter = calculateRetryAfterSeconds(params.rateLimit.resetAt, params.now);

  return {
    body: {
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter,
      access: params.access,
    },
    init: {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    },
  };
}

export function buildBookingCreateRateLimitResponse(params: {
  rateLimit: BookingRateLimitResult;
  now?: number;
}): RateLimitResponseSpec<{
  error: 'Too many booking requests. Please try again in a moment.';
  code: 'RATE_LIMITED';
  retryAfter: number;
}> {
  const retryAfter = calculateRetryAfterSeconds(params.rateLimit.resetAt, params.now);

  return {
    body: {
      error: 'Too many booking requests. Please try again in a moment.',
      code: 'RATE_LIMITED',
      retryAfter,
    },
    init: {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': params.rateLimit.limit.toString(),
        'X-RateLimit-Remaining': params.rateLimit.remaining.toString(),
        'X-RateLimit-Reset': params.rateLimit.resetAt.toString(),
      },
    },
  };
}
