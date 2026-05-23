import type { PastBookingError } from '@/server/bookings/pastTimeValidation';

export type PastTimeBlockedResponseBody = {
  error: string;
  code: PastBookingError['code'];
  details: PastBookingError['details'];
};

export function buildPastTimeBlockedResponse(error: PastBookingError): {
  body: PastTimeBlockedResponseBody;
  init: { status: 422 };
} {
  return {
    body: {
      error: error.message,
      code: error.code,
      details: error.details,
    },
    init: { status: 422 },
  };
}
