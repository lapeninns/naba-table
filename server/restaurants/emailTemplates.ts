import { normalizeRestaurantEmailTemplatesDocument, type RestaurantBookingEmailTemplateKey, type RestaurantEmailTemplateVariant, type RestaurantEmailTemplatesDocument } from '@/lib/restaurants/email-templates';
import { ensureLogoColumnOnRow, isLogoUrlColumnMissing, logLogoColumnFallback } from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { VenueDetails } from '@/lib/venue';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type RestaurantUpdate = Database['public']['Tables']['restaurants']['Update'];

async function selectRestaurant(
  client: DbClient,
  restaurantId: string,
): Promise<RestaurantRow> {
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
    timezone: restaurant.timezone || 'Europe/London',
    address: restaurant.address || '',
    phone: restaurant.contact_phone || '',
    email: restaurant.contact_email || '',
    policy: restaurant.booking_policy || '',
    logoUrl: restaurant.logo_url || null,
    googleMapUrl: restaurant.google_map_url || null,
    googleReviewUrl: restaurant.google_review_url || null,
    emailTemplates: normalizeRestaurantEmailTemplatesDocument(restaurant.email_templates),
  };
}

async function updateEmailTemplatesDocument(
  client: DbClient,
  restaurantId: string,
  nextDocument: RestaurantEmailTemplatesDocument,
): Promise<RestaurantRow> {
  const runUpdate = (includeLogo: boolean, payload: RestaurantUpdate) =>
    client
      .from('restaurants')
      .update(payload)
      .eq('id', restaurantId)
      .select(restaurantSelectColumns(includeLogo))
      .single<RestaurantRow>();

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
    throw new Error('Restaurant not found');
  }

  return ensureLogoColumnOnRow(data);
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
  const current = (await getRestaurantEmailTemplatesDocument(params.restaurantId, client)) ?? {
    version: 1 as const,
    templates: {},
  };

  const nextDocument: RestaurantEmailTemplatesDocument = {
    version: 1,
    templates: {
      ...current.templates,
      [params.templateKey]: {
        variants: params.variants,
      },
    },
  };

  const updated = await updateEmailTemplatesDocument(client, params.restaurantId, nextDocument);
  return mapVenueDetails(updated);
}

export async function resetRestaurantEmailTemplate(
  restaurantId: string,
  templateKey: RestaurantBookingEmailTemplateKey,
  client: DbClient = getServiceSupabaseClient(),
): Promise<VenueDetails> {
  const current = (await getRestaurantEmailTemplatesDocument(restaurantId, client)) ?? {
    version: 1 as const,
    templates: {},
  };

  const nextTemplates = { ...current.templates };
  delete nextTemplates[templateKey];

  const updated = await updateEmailTemplatesDocument(client, restaurantId, {
    version: 1,
    templates: nextTemplates,
  });

  return mapVenueDetails(updated);
}
