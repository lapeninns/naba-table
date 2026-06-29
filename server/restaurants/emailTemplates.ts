import {
  normalizeRestaurantEmailTemplatesDocument,
  type RestaurantBookingEmailTemplateKey,
  type RestaurantEmailTemplateVariant,
  type RestaurantEmailTemplatesDocument,
} from '@/lib/restaurants/email-templates';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import {
  ensureLogoColumnOnRow,
  isLogoUrlColumnMissing,
  logLogoColumnFallback,
} from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { VenueDetails } from '@/lib/venue';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type RestaurantUpdate = Database['public']['Tables']['restaurants']['Update'];
const EMAIL_TEMPLATE_UPDATE_MAX_RETRIES = 3;

async function selectRestaurant(client: DbClient, restaurantId: string): Promise<RestaurantRow> {
  const runSelect = (includeLogo: boolean) =>
    client
      .from('restaurants')
      .select(restaurantSelectColumns(includeLogo))
      .eq('id', restaurantId)
      .single<RestaurantRow>();

  let { data, error } = await runSelect(true);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('restaurant-email-templates.selectRestaurant');
    ({ data, error } = await runSelect(false));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    throw new Error(`Failed to fetch restaurant email template context: ${error.message}`);
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  return ensureLogoColumnOnRow(data);
}

function mapVenueDetails(restaurant: RestaurantRow): VenueDetails {
  return {
    id: restaurant.id,
    slug: restaurant.slug || '',
    name: restaurant.name || 'Restaurant',
    managerName: restaurant.manager_name ?? null,
    timezone: restaurant.timezone || 'Europe/London',
    address: restaurant.address || '',
    phone: restaurant.contact_phone || '',
    email: restaurant.contact_email || '',
    policy: restaurant.booking_policy || '',
    logoUrl: restaurant.logo_url || null,
    googleMapUrl: safeGoogleMapsUrl(restaurant.google_map_url),
    googleReviewUrl: safeGoogleReviewUrl(restaurant.google_review_url),
    emailTemplates: normalizeRestaurantEmailTemplatesDocument(restaurant.email_templates),
  };
}

async function updateEmailTemplatesDocument(
  client: DbClient,
  restaurantId: string,
  nextDocument: RestaurantEmailTemplatesDocument,
  expectedUpdatedAt: string | null,
): Promise<{ row: RestaurantRow | null; conflict: boolean }> {
  const runUpdate = (includeLogo: boolean, payload: RestaurantUpdate) => {
    const baseQuery = client.from('restaurants').update(payload).eq('id', restaurantId);
    const matchedQuery =
      expectedUpdatedAt === null
        ? baseQuery.is('updated_at', null)
        : baseQuery.eq('updated_at', expectedUpdatedAt);

    return matchedQuery.select(restaurantSelectColumns(includeLogo)).maybeSingle<RestaurantRow>();
  };

  let { data, error } = await runUpdate(true, {
    email_templates: nextDocument as unknown as RestaurantUpdate['email_templates'],
  });

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('restaurant-email-templates.updateEmailTemplatesDocument');
    ({ data, error } = await runUpdate(false, {
      email_templates: nextDocument as unknown as RestaurantUpdate['email_templates'],
    }));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    throw new Error(`Failed to update restaurant email templates: ${error.message}`);
  }

  if (!data) {
    return { row: null, conflict: true };
  }

  return { row: ensureLogoColumnOnRow(data), conflict: false };
}

function buildNextEmailTemplatesDocument(
  current: RestaurantEmailTemplatesDocument | null,
  updater: (
    templates: Partial<
      Record<RestaurantBookingEmailTemplateKey, { variants: RestaurantEmailTemplateVariant[] }>
    >,
  ) => Partial<
    Record<RestaurantBookingEmailTemplateKey, { variants: RestaurantEmailTemplateVariant[] }>
  >,
): RestaurantEmailTemplatesDocument {
  const currentTemplates = current?.templates ?? {};

  return {
    version: 1,
    templates: updater({ ...currentTemplates }),
  };
}

export async function getRestaurantEmailTemplateVenue(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<VenueDetails> {
  return mapVenueDetails(await selectRestaurant(client, restaurantId));
}

export async function getRestaurantEmailTemplatesDocument(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantEmailTemplatesDocument | null> {
  const restaurant = await selectRestaurant(client, restaurantId);
  return normalizeRestaurantEmailTemplatesDocument(restaurant.email_templates);
}

export async function upsertRestaurantEmailTemplate(
  params: {
    restaurantId: string;
    templateKey: RestaurantBookingEmailTemplateKey;
    variants: RestaurantEmailTemplateVariant[];
  },
  client: DbClient = getServiceSupabaseClient(),
): Promise<VenueDetails> {
  for (let attempt = 0; attempt < EMAIL_TEMPLATE_UPDATE_MAX_RETRIES; attempt += 1) {
    const currentRestaurant = await selectRestaurant(client, params.restaurantId);
    const currentDocument = normalizeRestaurantEmailTemplatesDocument(
      currentRestaurant.email_templates,
    );
    const nextDocument = buildNextEmailTemplatesDocument(currentDocument, (templates) => ({
      ...templates,
      [params.templateKey]: {
        variants: params.variants,
      },
    }));

    const result = await updateEmailTemplatesDocument(
      client,
      params.restaurantId,
      nextDocument,
      currentRestaurant.updated_at ?? null,
    );

    if (!result.conflict && result.row) {
      return mapVenueDetails(result.row);
    }
  }

  throw new Error('Failed to update restaurant email templates due to concurrent modifications');
}

export async function resetRestaurantEmailTemplate(
  restaurantId: string,
  templateKey: RestaurantBookingEmailTemplateKey,
  client: DbClient = getServiceSupabaseClient(),
): Promise<VenueDetails> {
  for (let attempt = 0; attempt < EMAIL_TEMPLATE_UPDATE_MAX_RETRIES; attempt += 1) {
    const currentRestaurant = await selectRestaurant(client, restaurantId);
    const currentDocument = normalizeRestaurantEmailTemplatesDocument(
      currentRestaurant.email_templates,
    );
    const nextDocument = buildNextEmailTemplatesDocument(currentDocument, (templates) => {
      delete templates[templateKey];
      return templates;
    });

    const result = await updateEmailTemplatesDocument(
      client,
      restaurantId,
      nextDocument,
      currentRestaurant.updated_at ?? null,
    );

    if (!result.conflict && result.row) {
      return mapVenueDetails(result.row);
    }
  }

  throw new Error('Failed to reset restaurant email templates due to concurrent modifications');
}
