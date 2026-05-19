import { NextResponse } from 'next/server';

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
import { requireAdminMembership, requireMembershipForRestaurant } from '@/server/team/access';

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

export async function ensureTemplateReadAccess(restaurantId: string): Promise<
  | {
      venue: VenueDetails;
      canEdit: boolean;
    }
  | NextResponse
> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const membership = await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId,
      client: supabase,
    });
    const venue = await getRestaurantEmailTemplateVenue(restaurantId);
    return {
      venue,
      canEdit: isRestaurantAdminRole(membership.role),
    };
  } catch (error) {
    console.error('[ops][restaurants][email-templates] membership guard failed', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
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

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });
    return getRestaurantEmailTemplateVenue(restaurantId);
  } catch (error) {
    console.error('[ops][restaurants][email-templates] admin guard failed', error);
    return NextResponse.json(
      { error: 'Forbidden: Owner or manager role required' },
      { status: 403 },
    );
  }
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
