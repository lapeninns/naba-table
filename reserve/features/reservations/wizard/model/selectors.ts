import {
  formatBookingLabel,
  formatReservationSummaryDate,
  formatReservationTime,
} from '@reserve/shared/formatting/booking';

import type { BookingDetails } from './reducer';

export type SelectionSummary = {
  primary: string;
  details: string[];
  srLabel: string;
};

export const createSelectionSummary = (details: BookingDetails): SelectionSummary => {
  const formattedDate = details.date
    ? formatReservationSummaryDate(details.date)
    : 'Date not selected';
  const formattedTime = details.time ? formatReservationTime(details.time) : 'Time not selected';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;
  const serviceLabel = formatBookingLabel(details.bookingType);
  const summaryLines = [partyText, formattedTime, formattedDate];

  return {
    primary: serviceLabel,
    details: summaryLines,
    srLabel: `${serviceLabel}. ${summaryLines.join(', ')}`,
  };
};
