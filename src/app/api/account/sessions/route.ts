import { NextResponse } from 'next/server';

import { describeAccountDevice } from '@/lib/account/session-device';
import {
  accountDeviceRenameSchema,
  accountSessionHeartbeatSchema,
} from '@/lib/account/session-schema';
import { QA_OPS_AUTH_COOKIE_NAME, getQaOpsAuthFixture } from '@/server/auth/qa-ops-session';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { AccountSessionsResponse } from '@/lib/account/session-schema';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

type AccountSessionRpcRow = {
  session_id: string;
  signed_in_at: string;
  last_seen_at: string;
  signed_out_at: string | null;
  user_agent: string | null;
  ip_address: string | null;
  device_id: string | null;
  device_name: string | null;
  device_first_seen_at: string | null;
  device_session_count: number | string | null;
  time_zone: string | null;
  locale: string | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  assurance_level: 'aal1' | 'aal2' | 'aal3' | null;
  refreshed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_current: boolean;
};

type AccountSessionRpcClient = {
  rpc: (
    functionName:
      | 'list_my_account_sessions'
      | 'touch_my_account_session'
      | 'end_my_account_session'
      | 'rename_my_account_device',
    params?: Record<string, string | null>,
  ) => Promise<{
    data: AccountSessionRpcRow[] | null;
    error: { code?: string; message: string } | null;
  }>;
};

type ApproximateLocation = {
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

function decodeLocationHeader(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded ? decoded.slice(0, maxLength) : null;
  } catch {
    return null;
  }
}

function getApproximateLocation(request: NextRequest): ApproximateLocation {
  const countryCode = request.headers.get('x-vercel-ip-country')?.trim().toUpperCase() ?? null;
  return {
    city: decodeLocationHeader(request.headers.get('x-vercel-ip-city'), 100),
    region: decodeLocationHeader(request.headers.get('x-vercel-ip-country-region'), 100),
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
  };
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const body = await request.text();
  if (!body.trim()) return {};
  return JSON.parse(body) as unknown;
}

function mapSessionRow(row: AccountSessionRpcRow): AccountSessionsResponse['sessions'][number] {
  const describedDevice = describeAccountDevice(row.user_agent);
  const hasLocation = Boolean(row.city || row.region || row.country_code);

  return {
    id: row.session_id,
    signedInAt: row.signed_in_at,
    lastActiveAt: row.last_seen_at,
    signedOutAt: row.signed_out_at,
    refreshedAt: row.refreshed_at,
    expiresAt: row.expires_at,
    ipAddress: row.ip_address,
    assuranceLevel: row.assurance_level,
    approximateLocation: hasLocation
      ? { city: row.city, region: row.region, countryCode: row.country_code }
      : null,
    isActive: row.is_active,
    isCurrent: row.is_current,
    device: {
      ...describedDevice,
      id: row.device_id,
      name: row.device_name,
      firstSeenAt: row.device_first_seen_at,
      sessionCount: Number(row.device_session_count ?? 0),
      timeZone: row.time_zone,
      locale: row.locale,
    },
  };
}

function getQaSessionsResponse(request: NextRequest): AccountSessionsResponse | null {
  const fixture = getQaOpsAuthFixture({
    cookieValue: request.cookies.get(QA_OPS_AUTH_COOKIE_NAME)?.value,
    host: request.headers.get('host'),
  });
  if (!fixture) return null;

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const rows: AccountSessionRpcRow[] = [
    {
      session_id: '99999999-9999-4999-8999-000000000001',
      signed_in_at: new Date(now - 5 * hour).toISOString(),
      last_seen_at: new Date(now).toISOString(),
      signed_out_at: null,
      user_agent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ip_address: '127.0.0.1',
      device_id: '88888888-8888-4888-8888-000000000001',
      device_name: 'Reception Mac',
      device_first_seen_at: new Date(now - 30 * day).toISOString(),
      device_session_count: 6,
      time_zone: 'Europe/London',
      locale: 'en-GB',
      city: 'London',
      region: 'ENG',
      country_code: 'GB',
      assurance_level: 'aal2',
      refreshed_at: new Date(now - 4 * 60 * 1000).toISOString(),
      expires_at: new Date(now + 30 * day).toISOString(),
      is_active: true,
      is_current: true,
    },
    {
      session_id: '99999999-9999-4999-8999-000000000002',
      signed_in_at: new Date(now - 2 * day).toISOString(),
      last_seen_at: new Date(now - 32 * 60 * 1000).toISOString(),
      signed_out_at: null,
      user_agent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ip_address: '192.0.2.25',
      device_id: '88888888-8888-4888-8888-000000000002',
      device_name: 'Bookings phone',
      device_first_seen_at: new Date(now - 45 * day).toISOString(),
      device_session_count: 3,
      time_zone: 'Europe/London',
      locale: 'en-GB',
      city: 'Cambridge',
      region: 'ENG',
      country_code: 'GB',
      assurance_level: 'aal1',
      refreshed_at: new Date(now - 32 * 60 * 1000).toISOString(),
      expires_at: new Date(now + 28 * day).toISOString(),
      is_active: true,
      is_current: false,
    },
    {
      session_id: '99999999-9999-4999-8999-000000000003',
      signed_in_at: new Date(now - 8 * day).toISOString(),
      last_seen_at: new Date(now - 7 * day).toISOString(),
      signed_out_at: new Date(now - 7 * day).toISOString(),
      user_agent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      ip_address: '198.51.100.42',
      device_id: null,
      device_name: null,
      device_first_seen_at: null,
      device_session_count: 0,
      time_zone: null,
      locale: null,
      city: null,
      region: null,
      country_code: null,
      assurance_level: 'aal1',
      refreshed_at: new Date(now - 7 * day).toISOString(),
      expires_at: null,
      is_active: false,
      is_current: false,
    },
  ];

  return {
    sessions: rows.map(mapSessionRow),
  };
}

async function requireAuthenticatedSession() {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    return {
      supabase,
      response: jsonError(mapped.status, mapped.code, mapped.message),
    } as const;
  }

  if (!user) {
    return {
      supabase,
      response: jsonError(401, 'UNAUTHENTICATED', 'You must be signed in to view sessions'),
    } as const;
  }

  return { supabase, response: null } as const;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const qaResponse = getQaSessionsResponse(request);
    if (qaResponse) {
      return NextResponse.json(qaResponse, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const auth = await requireAuthenticatedSession();
    if (auth.response) return auth.response;

    const { data, error } = await (auth.supabase as unknown as AccountSessionRpcClient).rpc(
      'list_my_account_sessions',
    );

    if (error) {
      console.error('[account/sessions][get] failed to list sessions', {
        code: error.code ?? null,
        message: error.message,
      });
      return jsonError(500, 'SESSION_LIST_FAILED', 'We couldn’t load your sessions. Try again.');
    }

    const response: AccountSessionsResponse = {
      sessions: (data ?? []).map(mapSessionRow),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[account/sessions][get] unexpected error', error);
    return jsonError(500, 'UNEXPECTED_ERROR', 'We couldn’t load your sessions. Try again.');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withCsrfProtectedMutation(request, async () => {
    try {
      if (getQaSessionsResponse(request)) {
        return NextResponse.json({ status: 'ok' });
      }

      const auth = await requireAuthenticatedSession();
      if (auth.response) return auth.response;

      let parsedBody: unknown;
      try {
        parsedBody = await readJsonBody(request);
      } catch {
        return jsonError(400, 'INVALID_REQUEST', 'Invalid session activity metadata');
      }

      const validated = accountSessionHeartbeatSchema.safeParse(parsedBody);
      if (!validated.success) {
        return jsonError(400, 'INVALID_REQUEST', 'Invalid session activity metadata');
      }

      const location = getApproximateLocation(request);

      const { error } = await (auth.supabase as unknown as AccountSessionRpcClient).rpc(
        'touch_my_account_session',
        {
          p_device_id: validated.data.deviceId ?? null,
          p_time_zone: validated.data.timeZone ?? null,
          p_locale: validated.data.locale ?? null,
          p_city: location.city,
          p_region: location.region,
          p_country_code: location.countryCode,
        },
      );

      if (error) {
        console.error('[account/sessions][post] failed to record activity', {
          code: error.code ?? null,
          message: error.message,
        });
        return jsonError(500, 'SESSION_ACTIVITY_FAILED', 'Unable to record session activity');
      }

      return NextResponse.json({ status: 'ok' });
    } catch (error) {
      console.error('[account/sessions][post] unexpected error', error);
      return jsonError(500, 'UNEXPECTED_ERROR', 'Unable to record session activity');
    }
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return withCsrfProtectedMutation(request, async () => {
    try {
      if (getQaSessionsResponse(request)) {
        return NextResponse.json({ status: 'ok' });
      }

      const auth = await requireAuthenticatedSession();
      if (auth.response) return auth.response;

      let parsedBody: unknown;
      try {
        parsedBody = await readJsonBody(request);
      } catch {
        return jsonError(400, 'INVALID_REQUEST', 'Invalid device name');
      }

      const validated = accountDeviceRenameSchema.safeParse(parsedBody);
      if (!validated.success) {
        return jsonError(400, 'INVALID_REQUEST', 'Use a device name between 1 and 60 characters');
      }

      const { error } = await (auth.supabase as unknown as AccountSessionRpcClient).rpc(
        'rename_my_account_device',
        {
          p_device_id: validated.data.deviceId,
          p_name: validated.data.name,
        },
      );

      if (error) {
        const notFound = error.code === 'P0002';
        return jsonError(
          notFound ? 404 : 500,
          notFound ? 'DEVICE_NOT_FOUND' : 'DEVICE_RENAME_FAILED',
          notFound ? 'That device is no longer available' : 'Unable to rename this device',
        );
      }

      return NextResponse.json({ status: 'ok' });
    } catch (error) {
      console.error('[account/sessions][patch] unexpected error', error);
      return jsonError(500, 'UNEXPECTED_ERROR', 'Unable to rename this device');
    }
  });
}
