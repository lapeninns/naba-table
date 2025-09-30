import { bookingHelpers } from '@reserve/shared/utils/booking';

import type { BookingDetails } from './reducer';

export type SelectionSummary = {
  primary: string;
  details: string[];
  srLabel: string;
};

export const createSelectionSummary = (details: BookingDetails): SelectionSummary => {
  const formattedDate = details.date
    ? bookingHelpers.formatSummaryDate(details.date)
    : 'Date not selected';
  const formattedTime = details.time
    ? bookingHelpers.formatTime(details.time)
    : 'Time not selected';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;
  const serviceLabel = bookingHelpers.formatBookingLabel(details.bookingType);
  const summaryLines = [partyText, formattedTime, formattedDate];

  return {
    primary: serviceLabel,
    details: summaryLines,
    srLabel: `${serviceLabel}. ${summaryLines.join(', ')}`,
  };
};
