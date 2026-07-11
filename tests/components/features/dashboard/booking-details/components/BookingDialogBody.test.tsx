import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { profilePanelSpy, desktopSectionSpy, mobileSectionSpy } = vi.hoisted(() => ({
  profilePanelSpy: vi.fn(() => <div data-testid="guest-profile-panel" />),
  desktopSectionSpy: vi.fn(() => <div data-testid="desktop-assignment-section" />),
  mobileSectionSpy: vi.fn(() => <div data-testid="mobile-assignment-section" />),
}));

vi.mock('@/components/features/dashboard/booking-details/components/GuestProfilePanel', () => ({
  GuestProfilePanel: profilePanelSpy,
}));
vi.mock(
  '@/components/features/dashboard/booking-details/components/BookingDialogTableAssignmentSection',
  () => ({
    BookingDialogDesktopTableAssignmentSection: desktopSectionSpy,
    BookingDialogMobileTableAssignmentSection: mobileSectionSpy,
  }),
);

import { BookingDialogBody } from '@/components/features/dashboard/booking-details/components/BookingDialogBody';

import {
  PINNED_DATE_KEY,
  PINNED_TIMEZONE,
  makeBooking,
  makeSummary,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { BookingDialogBodyProps } from '@/components/features/dashboard/booking-details/components/BookingDialogBody';

function makeProps(overrides: Partial<BookingDialogBodyProps> = {}): BookingDialogBodyProps {
  return {
    isLoading: false,
    errorMessage: null,
    booking: makeBooking(),
    summary: makeSummary(),
    isMobile: false,
    allowTableAssignments: true,
    needsAssignment: false,
    bookingDate: PINNED_DATE_KEY,
    timezone: PINNED_TIMEZONE,
    status: 'confirmed',
    minutesRemaining: null,
    assignedTableRows: [],
    totalCapacity: 0,
    capacityPercent: 0,
    isTableAssignmentOpen: false,
    onTableAssignmentOpenChange: vi.fn(),
    tablePanelRef: createRef<HTMLDivElement>(),
    tableAssignmentPrimaryFocusRef: createRef<HTMLButtonElement>(),
    onAssignmentComplete: vi.fn(),
    ...overrides,
  };
}

describe('BookingDialogBody', () => {
  it('@contract renders the loading skeleton first', () => {
    const { container } = render(<BookingDialogBody {...makeProps({ isLoading: true })} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('guest-profile-panel')).not.toBeInTheDocument();
  });

  it('@contract renders the error state with retry wired through', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <BookingDialogBody
        {...makeProps({ errorMessage: 'Could not load booking', onRetry })}
      />,
    );

    expect(screen.getByText('Could not load booking')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@contract renders the empty state without a booking', () => {
    render(<BookingDialogBody {...makeProps({ booking: null })} />);

    expect(screen.getByText('No booking selected')).toBeInTheDocument();
  });

  it('@contract desktop layout renders the profile panel beside the desktop assignment section', () => {
    render(<BookingDialogBody {...makeProps()} />);

    expect(screen.getByTestId('guest-profile-panel')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-assignment-section')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-assignment-section')).not.toBeInTheDocument();
  });

  it('@contract mobile layout renders the collapsible assignment section with its flags', () => {
    render(<BookingDialogBody {...makeProps({ isMobile: true, needsAssignment: true })} />);

    expect(screen.getByTestId('guest-profile-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-assignment-section')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-assignment-section')).not.toBeInTheDocument();

    const forwarded = mobileSectionSpy.mock.calls.at(-1)?.[0] as {
      needsAssignment: boolean;
      isOpen: boolean;
    };
    expect(forwarded.needsAssignment).toBe(true);
    expect(forwarded.isOpen).toBe(false);
  });
});
