import { fetchBookingsForContact } from '@/server/bookings';
import { stringifyError } from '@/server/bookings/error-formatting';
import { toGuestBookingDTO, type GuestBookingSource } from '@/server/bookings/guest-booking-dto';
import {
  markGuestLookupPolicyEnabled,
  markGuestLookupStrategy,
  type GuestLookupAccessDiagnostics,
} from '@/server/bookings/guest-lookup-access';
import {
  buildGuestLookupAllowedEvent,
  type GuestLookupAllowedEvent,
} from '@/server/bookings/guest-lookup-observability';
import {
  fetchGuestLookupPolicyBookings,
  type GuestLookupPolicyResult,
} from '@/server/bookings/guest-lookup-policy';
import { computeGuestLookupHash } from '@/server/security/guest-lookup';

type LegacyGuestLookupClient = Parameters<typeof fetchBookingsForContact>[0];
type GuestLookupBookingDTO = ReturnType<typeof toGuestBookingDTO>;

export type GuestLookupPolicyLog =
  | {
      kind: 'rpc_failed';
      message: string;
    }
  | {
      kind: 'unexpected_error';
      message: string;
    };

export type GuestLookupBookingsResult = {
  bookings: GuestLookupBookingDTO[];
  access: GuestLookupAccessDiagnostics;
  allowedEvent: GuestLookupAllowedEvent;
  policyLog?: GuestLookupPolicyLog;
};

export async function fetchGuestLookupBookings({
  policyClient,
  legacyClient,
  restaurantId,
  email,
  phone,
  access,
  policyEnabled,
  source,
  ipScope,
  contactHashFor = computeGuestLookupHash,
  policyFetch = fetchGuestLookupPolicyBookings,
  legacyFetch = fetchBookingsForContact,
}: {
  policyClient: unknown;
  legacyClient: LegacyGuestLookupClient;
  restaurantId: string;
  email: string;
  phone: string;
  access: GuestLookupAccessDiagnostics;
  policyEnabled: boolean;
  source: string;
  ipScope: string;
  contactHashFor?: typeof computeGuestLookupHash;
  policyFetch?: typeof fetchGuestLookupPolicyBookings;
  legacyFetch?: typeof fetchBookingsForContact;
}): Promise<GuestLookupBookingsResult> {
  let nextAccess = markGuestLookupPolicyEnabled(access, { policyEnabled });
  let policyLog: GuestLookupPolicyLog | undefined;

  if (policyEnabled) {
    const contactHash = contactHashFor({ restaurantId, email, phone });

    if (contactHash) {
      try {
        const policyResult = await policyFetch({
          client: policyClient,
          restaurantId,
          contactHash,
        });

        if (policyResult.status === 'matched') {
          nextAccess = markGuestLookupStrategy(nextAccess, { lookupStrategy: 'policy' });
          return buildGuestLookupBookingsResult({
            bookings: policyResult.bookings,
            access: nextAccess,
            source,
            restaurantId,
            ipScope,
          });
        }

        policyLog = getPolicyFallbackLog(policyResult);
      } catch (error) {
        policyLog = {
          kind: 'unexpected_error',
          message: stringifyError(error),
        };
      }
    }
  }

  const legacyBookings = await legacyFetch(legacyClient, restaurantId, email, phone);
  nextAccess = markGuestLookupStrategy(nextAccess, {
    lookupStrategy: policyEnabled ? 'legacy-fallback' : 'legacy',
  });

  return buildGuestLookupBookingsResult({
    bookings: legacyBookings.map((booking) => toGuestBookingDTO(booking as GuestBookingSource)),
    access: nextAccess,
    source,
    restaurantId,
    ipScope,
    policyLog,
  });
}

function getPolicyFallbackLog(
  policyResult: Extract<GuestLookupPolicyResult, { status: 'fallback' }>,
): GuestLookupPolicyLog | undefined {
  if (policyResult.shouldLogError && policyResult.errorMessage) {
    return {
      kind: 'rpc_failed',
      message: policyResult.errorMessage,
    };
  }

  return undefined;
}

function buildGuestLookupBookingsResult({
  bookings,
  access,
  source,
  restaurantId,
  ipScope,
  policyLog,
}: {
  bookings: GuestLookupBookingDTO[];
  access: GuestLookupAccessDiagnostics;
  source: string;
  restaurantId: string;
  ipScope: string;
  policyLog?: GuestLookupPolicyLog;
}): GuestLookupBookingsResult {
  return {
    bookings,
    access,
    allowedEvent: buildGuestLookupAllowedEvent({
      source,
      restaurantId,
      ipScope,
      count: bookings.length,
      policyEnabled: access.policyEnabled,
      lookupStrategy: access.lookupStrategy === 'unknown' ? 'legacy' : access.lookupStrategy,
      rateSource: access.rateSource,
      accessMode: access.mode,
      accessTokenUsed: access.token.provided,
    }),
    policyLog,
  };
}
