import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Check } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { BookingDialogActionRail } from '@/components/features/dashboard/booking-details/components/BookingDialogActionRail';

import { makeBooking } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { BookingDialogActionRailProps } from '@/components/features/dashboard/booking-details/components/BookingDialogActionRail';

function makeProps(
  overrides: Partial<BookingDialogActionRailProps> = {},
): BookingDialogActionRailProps {
  return {
    booking: makeBooking(),
    canCancel: true,
    copySummaryStatus: 'idle',
    formattedDate: 'Mon 15 Jun',
    formattedStartTime: '18:00',
    isActionPending: false,
    isMobile: false,
    primaryAction: {
      id: 'check-in',
      label: 'Check in',
      icon: Check,
      tone: '',
      onClick: vi.fn(),
    },
    shouldShowNoShow: true,
    srStatusMessage: '',
    summaryAvailable: true,
    onConfirmCancel: vi.fn(),
    onConfirmNoShow: vi.fn(),
    onCopyReference: vi.fn(),
    onCopySummary: vi.fn(),
    ...overrides,
  };
}

describe('BookingDialogActionRail', () => {
  it('@contract renders the call-guest shortcut and the primary action on desktop', () => {
    render(<BookingDialogActionRail {...makeProps()} />);

    expect(screen.getByRole('link', { name: /Call Guest/ })).toHaveAttribute(
      'href',
      expect.stringContaining('tel:'),
    );
    expect(screen.getByRole('button', { name: /Check in/ })).toBeEnabled();
  });

  it('@contract fires the primary action and disables it while pending', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const props = makeProps({
      primaryAction: { id: 'check-in', label: 'Check in', icon: Check, tone: '', onClick },
    });
    const { rerender } = render(<BookingDialogActionRail {...props} />);

    await user.click(screen.getByRole('button', { name: /Check in/ }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<BookingDialogActionRail {...props} isActionPending />);
    expect(screen.getByRole('button', { name: /Check in/ })).toBeDisabled();
  });

  it('@contract the operations menu exposes copy, no-show, and cancel commands', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<BookingDialogActionRail {...props} />);

    await user.click(screen.getByRole('button', { name: 'More operations' }));
    const menu = await screen.findByRole('menu');

    await user.click(within(menu).getByRole('menuitem', { name: /Copy summary/ }));
    expect(props.onCopySummary).toHaveBeenCalledTimes(1);

    await user.click(within(menu).getByRole('menuitem', { name: /Copy reference/ }));
    expect(props.onCopyReference).toHaveBeenCalledTimes(1);

    await user.click(within(menu).getByRole('menuitem', { name: /Mark no-show/ }));
    expect(props.onConfirmNoShow).toHaveBeenCalledTimes(1);

    await user.click(within(menu).getByRole('menuitem', { name: /Cancel booking/ }));
    expect(props.onConfirmCancel).toHaveBeenCalledTimes(1);
  });

  it('@contract hides destructive commands when not permitted', async () => {
    const user = userEvent.setup();
    render(
      <BookingDialogActionRail {...makeProps({ canCancel: false, shouldShowNoShow: false })} />,
    );

    await user.click(screen.getByRole('button', { name: 'More operations' }));
    const menu = await screen.findByRole('menu');

    expect(within(menu).queryByRole('menuitem', { name: /Mark no-show/ })).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitem', { name: /Cancel booking/ }),
    ).not.toBeInTheDocument();
  });

  it('@contract announces the sr-only status message politely', () => {
    render(<BookingDialogActionRail {...makeProps({ srStatusMessage: 'Summary copied' })} />);

    expect(screen.getByRole('status')).toHaveTextContent('Summary copied');
  });

  it('@contract shows the date stamp instead of the call shortcut without a phone', () => {
    render(
      <BookingDialogActionRail
        {...makeProps({ booking: makeBooking({ customerPhone: null }) })}
      />,
    );

    expect(screen.queryByRole('link', { name: /Call Guest/ })).not.toBeInTheDocument();
    expect(screen.getByText('Mon 15 Jun · 18:00')).toBeInTheDocument();
  });
});
