import type { SupabaseClient } from '@supabase/supabase-js';

import { reservationAdapter } from '@entities/reservation/adapter';

import type { Database } from '@/types/supabase';
import type { Reservation } from '@entities/reservation/reservation.schema';

export class GetReservationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'GetReservationError';
    if (options?.cause) {
      // Preserve original error for downstream logging / debugging.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- opaque cause bubble-up
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export type ReservationQueryResult = {
  reservation: Reservation;
  restaurantName: string | null;
};

export type GetReservationOptions = {
  supabase: SupabaseClient<Database, 'public', any>;
};

const RESERVATION_SELECT =
  'id,restaurant_id,booking_date,start_time,end_time,start_at,end_at,booking_type,seating_preference,status,party_size,customer_name,customer_email,customer_phone,marketing_opt_in,notes,reference,client_request_id,idempotency_key,pending_ref,details,created_at,updated_at,restaurants(name)';

export async function getReservation(
  id: string,
  { supabase }: GetReservationOptions,
): Promise<ReservationQueryResult | null> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(RESERVATION_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new GetReservationError(`[reservations] failed to load reservation ${id}`, { cause: error });
    }

    if (!data) {
      return null;
    }

    const reservation = reservationAdapter(data);

    return {
      reservation,
      restaurantName: reservation.restaurantName ?? null,
    };
  } catch (error) {
    if (error instanceof GetReservationError) {
      throw error;
    }

    throw new GetReservationError(`[reservations] unexpected error loading reservation ${id}`, {
      cause: error,
    });
  }
}
