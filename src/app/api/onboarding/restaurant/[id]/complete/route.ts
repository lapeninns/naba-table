import { NextResponse } from 'next/server';

import { validateCsrfToken } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const { id: restaurantId } = await context.params;
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ message: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  // Placeholder completion hook; real rollout can update onboarding flags or analytics.
  return NextResponse.json({ status: 'ok', restaurantId });
}
