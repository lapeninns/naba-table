import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingConfirmationActions } from '@features/reservations/wizard/ui/BookingConfirmationActions';

const start = new Date('2026-04-14T18:00:00Z');
const end = new Date('2026-04-14T19:30:00Z');

function renderActions(onDownloadIcs = vi.fn()) {
  render(
    <BookingConfirmationActions
      restaurantName="The Old Crown"
      restaurantAddress="1 High Street, Girton"
      start={start}
      end={end}
      partySize={4}
      bookingRef="REF-123"
      onDownloadIcs={onDownloadIcs}
    />,
  );
  return { onDownloadIcs };
}

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  openSpy.mockRestore();
});

describe('BookingConfirmationActions', () => {
  it('opens Google Maps directions for the venue address @contract', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /Directions/ }));

    expect(openSpy).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('1 High Street, Girton')}`,
      '_blank',
    );
  });

  it('builds a Google Calendar link with the reservation window @contract', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /Add to Calendar/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Google Calendar' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = new URL(openSpy.mock.calls[0]?.[0] as string);
    expect(url.origin + url.pathname).toBe('https://www.google.com/calendar/render');
    expect(url.searchParams.get('text')).toBe('Dinner at The Old Crown');
    expect(url.searchParams.get('dates')).toBe('20260414T180000Z/20260414T193000Z');
    expect(url.searchParams.get('details')).toContain('REF-123');
    expect(url.searchParams.get('location')).toBe('1 High Street, Girton');
  });

  it('delegates the ICS download to the provided handler @contract', async () => {
    const user = userEvent.setup();
    const { onDownloadIcs } = renderActions();

    await user.click(screen.getByRole('button', { name: /Add to Calendar/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Download .ICS File (Outlook/iCal)' }));

    expect(onDownloadIcs).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('prints the confirmation from the overflow menu @contract', async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderActions();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Print Confirmation/ }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
