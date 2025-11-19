
import { getServiceSupabaseClient } from '@/server/supabase';
import { getFallbackOccasionCatalog, toOccasionCatalog, toOccasionDefinition, type OccasionCatalog, type OccasionDefinition, type OccasionKey } from '@reserve/shared/occasions';

import type { Database } from '@/types/supabase';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

const CACHE_TTL_MS = 60_000;

const FALLBACK_CATALOG = getFallbackOccasionCatalog();

let cachedCatalog: { data: OccasionCatalog; fetchedAt: number } = {
  data: FALLBACK_CATALOG,
  fetchedAt: 0,
};

type CatalogOptions = {
  client?: SupabaseClient<Database, 'public'>;
  forceRefresh?: boolean;
  /**
   * If true, do not retry with the service client on permission errors.
   * Useful to prevent loops when the service client is already used.
   */
  disableServiceRetry?: boolean;
};

type OccasionRow = Database['public']['Tables']['booking_occasions']['Row'];
type OccasionDefinitionRow = Pick<
  OccasionRow,
  'key' | 'label' | 'short_label' | 'description' | 'availability' | 'default_duration_minutes' | 'display_order' | 'is_active'
>;

const mapRowsToDefinitions = (rows: OccasionDefinitionRow[]): OccasionDefinition[] => {
  const definitions: OccasionDefinition[] = [];
  for (const row of rows) {
    try {
      definitions.push(
        toOccasionDefinition({
          key: row.key,
          label: row.label,
          short_label: row.short_label,
          description: row.description,
          availability: row.availability,
          default_duration_minutes: row.default_duration_minutes,
          display_order: row.display_order,
          is_active: row.is_active,
        }),
      );
    } catch (error) {
      console.warn('[occasions][catalog] skipping invalid row', { key: row.key, error });
    }
  }
  return definitions;
};

async function fetchCatalogWithClient(client: SupabaseClient<Database, 'public'>) {
  const { data, error } = await client
    .from('booking_occasions')
    .select('key, label, short_label, description, availability, default_duration_minutes, display_order, is_active')
    .order('display_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    throw error;
  }

  return mapRowsToDefinitions(data ?? []).filter((definition) => definition.isActive);
}

export async function getOccasionCatalog(options: CatalogOptions = {}): Promise<OccasionCatalog> {
  const now = Date.now();
  if (!options.forceRefresh && now - cachedCatalog.fetchedAt < CACHE_TTL_MS) {
    return cachedCatalog.data;
  }

  const serviceClient = getServiceSupabaseClient();
  const requestedClient = options.client ?? serviceClient;
  const isServiceClient = !options.client;

  const attemptFetch = async (client: SupabaseClient<Database, 'public'>) => {
    const definitions = await fetchCatalogWithClient(client);
    const catalog = toOccasionCatalog(definitions);
    cachedCatalog = { data: catalog, fetchedAt: now };
    return catalog;
  };

  try {
    return await attemptFetch(requestedClient);
  } catch (error: unknown) {
    const code = extractErrorCode(error);
    const permissionDenied = code === '42501';
    if (permissionDenied && !isServiceClient && !options.disableServiceRetry) {
      console.warn('[occasions][catalog] permission denied with provided client, retrying with service role');
      try {
        return await attemptFetch(serviceClient);
      } catch (serviceError) {
        console.error('[occasions][catalog] service retry failed, using fallback', serviceError);
      }
    } else {
      console.error('[occasions][catalog] failed to load, using fallback', error);
    }
    cachedCatalog = { data: FALLBACK_CATALOG, fetchedAt: now };
    return FALLBACK_CATALOG;
  }
}

export function clearOccasionCatalogCache() {
  cachedCatalog = { data: FALLBACK_CATALOG, fetchedAt: 0 };
}

export function getCachedOccasionCatalog(): OccasionCatalog {
  return cachedCatalog.data;
}

export async function getOccasionDefinition(key: OccasionKey, options?: CatalogOptions): Promise<OccasionDefinition | null> {
  const catalog = await getOccasionCatalog(options);
  return catalog.byKey.get(key) ?? null;
}

export async function getOccasionDurationMinutes(key: OccasionKey, options?: CatalogOptions): Promise<number> {
  const definition = await getOccasionDefinition(key, options);
  if (definition) {
    return definition.defaultDurationMinutes;
  }
  const fallback = getFallbackOccasionCatalog();
  return fallback.byKey.get(key)?.defaultDurationMinutes ?? fallback.definitions[0]?.defaultDurationMinutes ?? 90;
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const code = (error as PostgrestError | { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
