import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingCardActions } from '@/components/features/dashboard/cards/OpsBookingCardActions';

import type {
  BookingMeta,
  OpsBookingCardActionsModel,
} from '@/components/features/dashboard/cards/opsBookingCardUtils';
import type { BookingDTO } from '@/hooks/useBookings';

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
    guest: overrides.guest ?? {
      label: 'Alice Example',
      initials: 'AE',
      isWalkInGuest: false,
    },
    dateLabel: overrides.dateLabel ?? 'Fri, Feb 6',
    timeRangeLabel: overrides.timeRangeLabel ?? '6:00 PM – 7:30 PM',
  };
}

function makeActions(overrides: Partial<OpsBookingCardActionsModel> = {}): OpsBookingCardActionsModel {
  return {
    bookingId: overrides.bookingId ?? 'b-1',
    pendingAction: overrides.pendingAction ?? null,
    disableActions: overrides.disableActions ?? false,
    footerCompletionLabel: overrides.footerCompletionLabel ?? null,
    dialog: overrides.dialog ?? {
      customerLabel: 'Alice Example',
      partySize: 2,
      dateLabel: 'Fri, Feb 6',
      timeRangeLabel: '6:00 PM – 7:30 PM',
    },
    policy: overrides.policy ?? {
      details: { disabled: false },
      menu: {
        edit: { disabled: false },
        cancel: { disabled: false },
        noShow: { hidden: false, disabled: false },
      },
      primary: {
        hidden: false,
        action: 'check-in',
        label: 'Seat Guest',
        disabled: false,
        pending: false,
      },
    },
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
        actions={makeActions({
          bookingId: 'b-1',
          dialog: {
            customerLabel: 'Alice Example',
            partySize: 4,
            dateLabel: 'Fri, Feb 6',
            timeRangeLabel: '6:00 PM – 7:30 PM',
          },
        })}
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
        meta={makeMeta({
          guest: {
            label: 'Bob Example',
            initials: 'BE',
            isWalkInGuest: false,
          },
        })}
        actions={makeActions({
          bookingId: 'b-2',
          dialog: {
            customerLabel: 'Bob Example',
            partySize: 2,
            dateLabel: 'Fri, Feb 6',
            timeRangeLabel: '6:00 PM – 7:30 PM',
          },
        })}
        onMarkNoShow={onMarkNoShow}
      />,
    );

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    expect(onMarkNoShow).toHaveBeenCalledTimes(0);
  });
});
