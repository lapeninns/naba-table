import {
  formatBookingLabel,
  formatReservationSummaryDate,
  formatReservationTime,
} from '@reserve/shared/formatting/booking';

import type { BookingDetails } from './reducer';

/** A labeled booking fact for the wizard-nav summary sheet. */
export type SummaryFact = {
  label: string;
  value: string;
};

export type SelectionSummary = {
  primary: string;
  details: string[];
  srLabel: string;
  facts: SummaryFact[];
};

export const createSelectionSummary = (details: BookingDetails): SelectionSummary => {
  const formattedDate = details.date
    ? formatReservationSummaryDate(details.date)
    : 'Date not selected';
  const formattedTime = details.time ? formatReservationTime(details.time) : 'Time not selected';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;
  const serviceLabel = formatBookingLabel(details.bookingType);
  const summaryLines = [partyText, formattedTime, formattedDate];

  // Labeled facts for the expandable summary sheet, in reading order. Notes are
  // included only when the guest entered them; every other value is always
  // present (date/time carry a "not selected" placeholder).
  const facts: SummaryFact[] = [
    { label: 'Date', value: formattedDate },
    { label: 'Time', value: formattedTime },
    { label: 'Party', value: partyText },
    { label: 'Service', value: serviceLabel },
    { label: 'Notes', value: details.notes?.trim() ?? '' },
  ].filter((fact) => fact.value.length > 0);

  return {
    primary: serviceLabel,
    details: summaryLines,
    srLabel: `${serviceLabel}. ${summaryLines.join(', ')}`,
    facts,
  };
};
