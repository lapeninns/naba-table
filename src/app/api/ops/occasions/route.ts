import { NextResponse, type NextRequest } from 'next/server';

import { apiError, conflict, forbidden, internalError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  GuardError,
  listUserRestaurantMemberships,
  requireSession,
  withPlatformAdminAuthorization,
} from '@/server/auth/guards';
import {
  createOccasion,
  fetchAllOccasions,
  OccasionAlreadyExistsError,
} from '@/server/occasions/admin';
import { createOccasionBodySchema } from '@/server/occasions/adminSchemas';
import { clearOccasionCatalogCache } from '@/server/occasions/catalog';

const ROUTE = 'ops.occasions';

async function authorizeOccasionCatalogRead(): Promise<NextResponse | null> {
  try {
    const { supabase, user } = await requireSession();
    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    if (memberships.length === 0) {
      return forbidden('FORBIDDEN', 'Forbidden');
    }
    return null;
  } catch (error) {
    if (error instanceof GuardError) {
      return apiError(error.status, error.code, error.message);
    }
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-occasions-auth' },
    });
    return internalError(error, { route: ROUTE, method: 'GET', stage: 'access' });
  }
}

export async function GET() {
  const unauthorizedResponse = await authorizeOccasionCatalogRead();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const occasions = await fetchAllOccasions();
    return NextResponse.json({ occasions });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-occasions' },
    });
    return internalError(error, { route: ROUTE, method: 'GET' });
  }
}

/** Creates a global booking type. Platform administrators only. */
export async function POST(request: NextRequest) {
  const authorization = await withPlatformAdminAuthorization(request, { csrf: true });
  if (!authorization.ok) {
    return authorization.response;
  }

  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return apiError(400, 'INVALID_JSON', 'The request body must be JSON.');
  }
  const parsed = createOccasionBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const occasion = await createOccasion(parsed.data, authorization.user.id);
    clearOccasionCatalogCache();
    return NextResponse.json({ occasion });
  } catch (error) {
    if (error instanceof OccasionAlreadyExistsError) {
      return conflict(
        'OCCASION_ALREADY_EXISTS',
        'A booking type with this key already exists. Choose a different key.',
      );
    }
    captureServerException(error, {
      distinctId: authorization.user.id,
      properties: { source: 'ops', kind: 'ops-occasions' },
    });
    return internalError(error, { route: ROUTE, method: 'POST' });
  }
}
