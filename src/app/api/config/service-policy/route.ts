import { NextResponse } from 'next/server';

import { internalError, notFound } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

const ROUTE = '/api/config/service-policy';

export async function GET() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const { data, error } = await supabase
      .from('service_policy')
      .select(
        'lunch_start, lunch_end, dinner_start, dinner_end, clean_buffer_minutes, allow_after_hours',
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      return internalError(
        error,
        { route: ROUTE, errorKind: error.code },
        'Failed to load service policy',
      );
    }

    if (!data) {
      return notFound('SERVICE_POLICY_NOT_CONFIGURED', 'Service policy not configured.');
    }

    return NextResponse.json({
      policy: {
        lunch: {
          start: data.lunch_start,
          end: data.lunch_end,
        },
        dinner: {
          start: data.dinner_start,
          end: data.dinner_end,
        },
        cleanBufferMinutes: data.clean_buffer_minutes,
        allowAfterHours: data.allow_after_hours,
      },
    });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'api', kind: 'config-service-policy' },
    });
    return internalError(error, { route: ROUTE }, 'An unexpected error occurred');
  }
}
