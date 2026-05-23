import { withValidationHeaders } from '@/server/booking/http';
import { toGuestBookingDTO } from '@/server/bookings/guest-booking-dto';

import type { BookingRecord } from '@/server/bookings';

type BookingCreateSuccessResponseInit = {
  status: 200 | 201;
  headers?: Record<string, string>;
};

export type BookingCreateSuccessResponseBody = {
  booking: ReturnType<typeof toGuestBookingDTO>;
  loyaltyPointsAwarded: number;
  clientRequestId: BookingRecord['client_request_id'];
  duplicate: boolean;
  capacity: null;
};

export function buildBookingCreateSuccessResponse(params: {
  booking: BookingRecord;
  loyaltyPointsAwarded: number;
  duplicate: boolean;
  useUnifiedValidation: boolean;
}): {
  body: BookingCreateSuccessResponseBody;
  init: BookingCreateSuccessResponseInit;
} {
  const status: 200 | 201 = params.duplicate ? 200 : 201;
  const init = params.useUnifiedValidation ? withValidationHeaders({ status }) : { status };

  return {
    body: {
      booking: toGuestBookingDTO(params.booking),
      loyaltyPointsAwarded: params.loyaltyPointsAwarded,
      clientRequestId: params.booking.client_request_id,
      duplicate: params.duplicate,
      capacity: null,
    },
    init,
  };
}
