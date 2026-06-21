import { stringifyError } from '@/server/bookings/error-formatting';
import { toGuestBookingDTO, type GuestBookingSource } from '@/server/bookings/guest-booking-dto';

export type GuestLookupPolicyRpcClient = {
  rpc: (
    fn: 'get_guest_bookings',
    args: { p_restaurant_id: string; p_hash: string },
  ) => Promise<{ data: unknown; error: unknown }>;
};

export type GuestLookupPolicyResult =
  | {
      status: 'matched';
      bookings: ReturnType<typeof toGuestBookingDTO>[];
    }
  | {
      status: 'fallback';
      errorMessage: string | null;
      shouldLogError: boolean;
    };

export async function fetchGuestLookupPolicyBookings(params: {
  client: unknown;
  restaurantId: string;
  contactHash: string;
}): Promise<GuestLookupPolicyResult> {
  const client = params.client as GuestLookupPolicyRpcClient;
  const { data: guestRows, error: guestError } = await client.rpc('get_guest_bookings', {
    p_restaurant_id: params.restaurantId,
    p_hash: params.contactHash,
  });

  if (!guestError && Array.isArray(guestRows)) {
    return {
      status: 'matched',
      bookings: mapGuestLookupPolicyRows(guestRows),
    };
  }

  if (!guestError) {
    return {
      status: 'fallback',
      errorMessage: null,
      shouldLogError: false,
    };
  }

  const message = stringifyError(guestError);
  return {
    status: 'fallback',
    errorMessage: message,
    shouldLogError: !isMissingGuestLookupPolicyFunction(guestError, message),
  };
}

export function mapGuestLookupPolicyRows(rows: unknown[]): ReturnType<typeof toGuestBookingDTO>[] {
  return rows.filter(isGuestBookingSource).map((booking) => toGuestBookingDTO(booking));
}

export function isMissingGuestLookupPolicyFunction(
  error: unknown,
  message = stringifyError(error),
) {
  const code =
    typeof (error as { code?: unknown } | null | undefined)?.code === 'string'
      ? (error as { code: string }).code
      : undefined;

  return code === 'PGRST100' || code === '42883' || message.includes('get_guest_bookings');
}

function isGuestBookingSource(value: unknown): value is GuestBookingSource {
  return Boolean(value && typeof value === 'object' && 'id' in value);
}
