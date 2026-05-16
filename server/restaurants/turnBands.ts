import { getServiceSupabaseClient } from '@/server/supabase';

import type { TurnBand, TurnBandsByOption } from '@/server/capacity/policy';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TurnBandInput = {
  maxPartySize: number;
  durationMinutes: number;
};

export type TurnBandsPayload = Record<string, TurnBandInput[]>;

type DbClient = SupabaseClient<Database>;

type TurnBandRow = {
  booking_option: string;
  max_party_size: number;
  duration_minutes: number;
};

type TurnBandReplacementRow = {
  restaurant_id: string;
  booking_option: string;
  max_party_size: number;
  duration_minutes: number;
};

type ReplacementRpcClient = DbClient & {
  rpc(
    fn: 'replace_restaurant_turn_bands',
    args: { p_restaurant_id: string; p_rows: TurnBandReplacementRow[] },
  ): Promise<{ error: { message?: string } | null }>;
};

const MAX_DURATION_MINUTES = 1440;

function normalizeOptionKey(value: string | null | undefined): string {
  const normalized = value?.toString().trim().toLowerCase() ?? '';
  if (!normalized) {
    throw new Error('Booking option is required');
  }
  return normalized;
}

function normalizeBandInput(entry: TurnBandInput, optionKey: string, index: number): TurnBand {
  const maxPartySize = Number(entry?.maxPartySize);
  const durationMinutes = Number(entry?.durationMinutes);

  if (!Number.isInteger(maxPartySize) || maxPartySize <= 0) {
    throw new Error(
      `Turn band ${index + 1} for "${optionKey}" must have a positive max party size.`,
    );
  }

  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new Error(
      `Turn band ${index + 1} for "${optionKey}" must have duration between 1 and ${MAX_DURATION_MINUTES} minutes.`,
    );
  }

  return { maxPartySize, durationMinutes };
}

export function normalizeTurnBandsPayload(
  payload: TurnBandsPayload,
  validOptions?: Set<string>,
): TurnBandsByOption {
  const normalized: TurnBandsByOption = {};

  for (const [rawKey, rawBands] of Object.entries(payload ?? {})) {
    const optionKey = normalizeOptionKey(rawKey);
    if (validOptions && !validOptions.has(optionKey)) {
      throw new Error(`Unknown booking option "${optionKey}".`);
    }

    if (!Array.isArray(rawBands) || rawBands.length === 0) {
      throw new Error(`Turn bands for "${optionKey}" are required.`);
    }

    const bands = rawBands.map((band, index) => normalizeBandInput(band, optionKey, index));
    bands.sort((a, b) => a.maxPartySize - b.maxPartySize);

    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i]!.maxPartySize === bands[i - 1]!.maxPartySize) {
        throw new Error(`Turn bands for "${optionKey}" must have unique max party sizes.`);
      }
    }

    normalized[optionKey] = bands;
  }

  return normalized;
}

export async function getRestaurantTurnBands(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<TurnBandsByOption> {
  const { data, error } = await client
    .from('restaurant_turn_bands')
    .select('booking_option, max_party_size, duration_minutes')
    .eq('restaurant_id', restaurantId)
    .order('booking_option', { ascending: true })
    .order('max_party_size', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TurnBandRow[];
  const grouped: TurnBandsByOption = {};

  rows.forEach((row) => {
    const key = row.booking_option?.toString().trim().toLowerCase();
    if (!key) {
      return;
    }
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key]!.push({
      maxPartySize: row.max_party_size,
      durationMinutes: row.duration_minutes,
    });
  });

  Object.values(grouped).forEach((bands) => bands.sort((a, b) => a.maxPartySize - b.maxPartySize));

  return grouped;
}

async function loadValidBookingOptions(client: DbClient): Promise<Set<string>> {
  const { data, error } = await client.from('booking_occasions').select('key');
  if (error) {
    throw error;
  }

  return new Set(
    (data ?? []).map((row) => row.key?.toString().trim().toLowerCase()).filter(Boolean),
  );
}

export async function replaceRestaurantTurnBands(
  restaurantId: string,
  payload: TurnBandsPayload,
  client: DbClient = getServiceSupabaseClient(),
): Promise<TurnBandsByOption> {
  const validOptions = await loadValidBookingOptions(client);
  const normalized = normalizeTurnBandsPayload(payload ?? {}, validOptions);

  const rows: TurnBandReplacementRow[] = Object.entries(normalized).flatMap(([optionKey, bands]) =>
    bands.map((band) => ({
      restaurant_id: restaurantId,
      booking_option: optionKey,
      max_party_size: band.maxPartySize,
      duration_minutes: band.durationMinutes,
    })),
  );

  const { error: replaceError } = await (client as ReplacementRpcClient).rpc(
    'replace_restaurant_turn_bands',
    {
      p_restaurant_id: restaurantId,
      p_rows: rows,
    },
  );

  if (replaceError) {
    throw replaceError;
  }

  return getRestaurantTurnBands(restaurantId, client);
}
