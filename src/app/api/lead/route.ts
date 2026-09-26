import { NextResponse } from 'next/server';

import { apiError, internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/lead';

type LeadPayload = {
  email: string;
};

function isLeadPayload(value: unknown): value is LeadPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { email?: unknown }).email === 'string'
  );
}

// This route is used to store the leads that are generated from the landing page.
// The API call is initiated by <ButtonLead /> component
export async function POST(req: NextRequest) {
  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'lead:create',
    limit: 5,
    windowMs: 60_000,
    message: 'Too many lead requests. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Malformed JSON used to escape as an unhandled 500; it is a client error.
    return apiError(400, 'INVALID_REQUEST_BODY', 'Invalid request body.');
  }

  if (!isLeadPayload(body)) {
    return apiError(400, 'EMAIL_REQUIRED', 'Email is required.');
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const { error } = await supabase.from('leads').insert({ email: body.email });

    if (error) {
      return internalError(
        error,
        { route: ROUTE, stage: 'insert', errorKind: error.code },
        'Unable to store lead',
      );
    }

    return NextResponse.json({});
  } catch (error: unknown) {
    captureServerException(error, {
      properties: { source: 'api', kind: 'lead' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to store lead');
  }
}
