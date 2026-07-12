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

/**
 * Summary for the confirmation step. Once a booking exists, the sheet should
 * surface the details a guest needs *after* booking — the reference and when /
 * party — not the pre-booking Date/Time/Party/Service selection.
 */
export const createConfirmationSummary = (
  reference: string,
  details: BookingDetails,
): SelectionSummary => {
  const formattedDate = details.date ? formatReservationSummaryDate(details.date) : 'TBC';
  const formattedTime = details.time ? formatReservationTime(details.time) : 'TBC';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;
  const when = `${formattedDate} · ${formattedTime}`;
  // The collapsed line stays party/time/date; the reference is the expand-to-see
  // fact (and is already prominent in the confirmation body), so it is not
  // duplicated in the one-line summary.
  const summaryLines = [partyText, formattedTime, formattedDate];

  return {
    primary: 'Booking confirmed',
    details: summaryLines,
    srLabel: `Booking confirmed. Reference ${reference}. ${partyText}, ${when}.`,
    facts: [
      { label: 'Reference', value: reference },
      { label: 'When', value: when },
      { label: 'Party', value: partyText },
    ],
  };
};
