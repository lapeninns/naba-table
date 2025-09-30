import type { QueryKey } from '@tanstack/react-query';

const RESERVATIONS_ROOT = 'reservations' as const;
const RESERVATIONS_KEY = [RESERVATIONS_ROOT] as const;
const RESERVATION_DETAIL = 'reservation' as const;

type ReservationIdentifier = string | null | undefined;

export const reservationKeys = {
  all(): QueryKey {
    return RESERVATIONS_KEY;
  },
  detail(reservationId: ReservationIdentifier): QueryKey {
    return [RESERVATION_DETAIL, reservationId ?? null] as const;
  },
};

export type ReservationQueryKey = ReturnType<typeof reservationKeys.detail>;
