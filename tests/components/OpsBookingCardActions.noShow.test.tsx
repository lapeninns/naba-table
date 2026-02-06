import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingCardActions } from '@/components/features/dashboard/cards/OpsBookingCardActions';

import type { BookingDTO } from '@/hooks/useBookings';
import type { BookingMeta } from '@/components/features/dashboard/cards/opsBookingCardUtils';

function makeBooking(overrides: Partial<BookingDTO> & Pick<BookingDTO, 'id'>): BookingDTO {
  return {
    id: overrides.id,
    restaurantName: overrides.restaurantName ?? 'Test Restaurant',
    partySize: overrides.partySize ?? 2,
    startIso: overrides.startIso ?? new Date('2026-02-06T18:00:00.000Z').toISOString(),
    endIso: overrides.endIso ?? new Date('2026-02-06T19:30:00.000Z').toISOString(),
    status: overrides.status ?? 'confirmed',
    ...overrides,
  };
}

function makeMeta(overrides: Partial<BookingMeta> = {}): BookingMeta {
  return {
    startDate: overrides.startDate ?? new Date('2026-02-06T18:00:00.000Z'),
    isToday: overrides.isToday ?? true,
    isPastDay: overrides.isPastDay ?? false,
    isDone: overrides.isDone ?? false,
    isSeated: overrides.isSeated ?? false,
    dateLabel: overrides.dateLabel ?? 'Fri, Feb 6',
    timeRangeLabel: overrides.timeRangeLabel ?? '6:00 PM – 7:30 PM',
    customerLabel: overrides.customerLabel ?? 'Alice Example',
    initials: overrides.initials ?? 'AE',
  };
}

describe('OpsBookingCardActions no-show confirmation', () => {
  it('does not call onMarkNoShow until confirm is pressed', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions
        booking={makeBooking({ id: 'b-1', partySize: 4, customerName: 'Alice Example' })}
        meta={makeMeta()}
        disableActions={false}
        onMarkNoShow={onMarkNoShow}
      />,
    );

    // Open menu.
    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));

    expect(onMarkNoShow).toHaveBeenCalledTimes(0);

    // Confirm in dialog.
    await user.click(screen.getByRole('button', { name: /confirm no-show/i }));
    expect(onMarkNoShow).toHaveBeenCalledTimes(1);
    expect(onMarkNoShow).toHaveBeenCalledWith('b-1');
  });

  it('cancel closes dialog without calling onMarkNoShow', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions
        booking={makeBooking({ id: 'b-2', customerName: 'Bob Example' })}
        meta={makeMeta({ customerLabel: 'Bob Example' })}
        disableActions={false}
        onMarkNoShow={onMarkNoShow}
      />,
    );

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    expect(onMarkNoShow).toHaveBeenCalledTimes(0);
  });
});

