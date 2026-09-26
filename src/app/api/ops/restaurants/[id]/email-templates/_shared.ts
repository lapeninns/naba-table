import { NextResponse } from 'next/server';

import { forbidden, unauthenticated } from '@/lib/api/errors';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import {
  BOOKING_EMAIL_TEMPLATE_VARIABLE_TOKENS,
  buildEditableTemplateVariants,
  getActiveTemplateVariants,
  getDefaultTemplateVariants,
  getEffectiveTemplateVariants,
  getRestaurantBookingEmailTemplateCatalog,
  getRestaurantBookingEmailTemplateGroups,
  getRestaurantBookingEmailTemplateDefinition,
  type RestaurantBookingEmailTemplateKey,
} from '@/lib/restaurants/email-templates';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getRestaurantEmailTemplateVenue } from '@/server/restaurants/emailTemplates';
import { validateCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import {
  MembershipAccessError,
  requireAdminMembership,
  requireMembershipForRestaurant,
} from '@/server/team/access';

import { templateRouteFailure } from './_errors';

import type { RestaurantEmailTemplateDTO, RestaurantEmailTemplateGroupDTO } from '../../schema';
import type { VenueDetails } from '@/lib/venue';
import type { NextRequest } from 'next/server';

export type RouteParams = {
  params: Promise<{
    id: string | string[];
    templateKey?: string | string[];
  }>;
};

export async function resolveRestaurantId(
  paramsPromise: Promise<{ id: string | string[]; templateKey?: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function resolveTemplateKeyParam(
  paramsPromise: Promise<{ id: string | string[]; templateKey?: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { templateKey } = params;
  if (typeof templateKey === 'string') return templateKey;
  if (Array.isArray(templateKey)) return templateKey[0] ?? null;
  return null;
}

type AuthenticatedRouteClient = {
  supabase: Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;
  userId: string;
};

async function resolveAuthenticatedUser(): Promise<AuthenticatedRouteClient | NextResponse> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return mapped.status === 401
      ? unauthenticated()
      : templateRouteFailure(authError, { operation: 'access', stage: 'auth' });
  }

  if (!user) {
    return unauthenticated();
  }

  return { supabase, userId: user.id };
}

function isMembershipDenied(error: unknown): boolean {
  return error instanceof MembershipAccessError && error.status === 403;
}

async function loadVenue(restaurantId: string): Promise<VenueDetails | NextResponse> {
  try {
    return await getRestaurantEmailTemplateVenue(restaurantId);
  } catch (error) {
    return templateRouteFailure(error, { operation: 'access', stage: 'venue', restaurantId });
  }
}

export async function ensureTemplateReadAccess(restaurantId: string): Promise<
  | {
      venue: VenueDetails;
      canEdit: boolean;
    }
  | NextResponse
> {
  const auth = await resolveAuthenticatedUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let role: string;
  try {
    const membership = await requireMembershipForRestaurant({
      userId: auth.userId,
      restaurantId,
      client: auth.supabase,
    });
    role = membership.role;
  } catch (error) {
    if (isMembershipDenied(error)) {
      return forbidden();
    }
    return templateRouteFailure(error, { operation: 'access', stage: 'membership', restaurantId });
  }

  const venue = await loadVenue(restaurantId);
  if (venue instanceof NextResponse) {
    return venue;
  }

  return { venue, canEdit: isRestaurantAdminRole(role) };
}

export async function ensureTemplateWriteAccess(
  restaurantId: string,
  req?: NextRequest,
): Promise<VenueDetails | NextResponse> {
  if (req) {
    const csrfFailure = validateCsrfProtectedMutation(req);
    if (csrfFailure) {
      return csrfFailure;
    }
  }

  const auth = await resolveAuthenticatedUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await requireAdminMembership({
      userId: auth.userId,
      restaurantId,
      client: auth.supabase,
    });
  } catch (error) {
    if (isMembershipDenied(error)) {
      return forbidden(
        'ADMIN_ROLE_REQUIRED',
        'Only owners and managers can change email templates.',
      );
    }
    return templateRouteFailure(error, { operation: 'access', stage: 'membership', restaurantId });
  }

  return loadVenue(restaurantId);
}

export function buildTemplateDto(
  venue: VenueDetails,
  templateKey: RestaurantBookingEmailTemplateKey,
): RestaurantEmailTemplateDTO {
  const definition = getRestaurantBookingEmailTemplateDefinition(templateKey);
  const effective = getEffectiveTemplateVariants(templateKey, venue.emailTemplates);
  const variants = buildEditableTemplateVariants(templateKey, venue.emailTemplates);

  return {
    key: templateKey,
    title: definition.title,
    description: definition.description,
    groupKey: definition.group,
    supportsCtaLabel: definition.supportsCtaLabel,
    availableVariables: [...BOOKING_EMAIL_TEMPLATE_VARIABLE_TOKENS],
    recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
    authoringHints: [...definition.authoringHints],
    status: effective.source,
    activeVariantCount: getActiveTemplateVariants(variants).length,
    variants,
    defaultVariants: getDefaultTemplateVariants(templateKey),
  };
}

export function buildTemplateGroups(venue: VenueDetails): RestaurantEmailTemplateGroupDTO[] {
  const templateMap = new Map(
    getRestaurantBookingEmailTemplateCatalog().map((definition) => [
      definition.key,
      buildTemplateDto(venue, definition.key),
    ]),
  );

  return getRestaurantBookingEmailTemplateGroups().map((group) => ({
    key: group.key,
    title: group.title,
    description: group.description,
    templates: getRestaurantBookingEmailTemplateCatalog()
      .filter((definition) => definition.group === group.key)
      .map((definition) => templateMap.get(definition.key)!)
      .filter(Boolean),
  }));
}
