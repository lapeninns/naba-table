import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { panelSpy } = vi.hoisted(() => ({
  panelSpy: vi.fn(() => <div data-testid="table-assignment-panel" />),
}));

// The real panel is a react-query + realtime heavyweight with its own suite
// (tests/a11y/tableAssignmentPanel.a11y.test.tsx); stub the module the
// section lazy-loads via next/dynamic.
vi.mock('@/components/features/dashboard/booking-details/components/TableAssignmentPanel', () => ({
  TableAssignmentPanel: panelSpy,
}));

import {
  BookingDialogDesktopTableAssignmentSection,
  BookingDialogMobileTableAssignmentSection,
} from '@/components/features/dashboard/booking-details/components/BookingDialogTableAssignmentSection';

function makeShared() {
  return {
    allowTableAssignments: true,
    assignedTableRows: [],
    bookingEndTime: null,
    bookingId: 'booking-1',
    bookingStartTime: null,
    date: '2026-06-15',
    initialFocusRef: createRef<HTMLButtonElement>(),
    onAssignmentComplete: vi.fn(),
    partySize: 4,
    realtime: false,
    restaurantId: 'restaurant-1',
    tablePanelRef: createRef<HTMLDivElement>(),
  };
}

describe('BookingDialogMobileTableAssignmentSection', () => {
  it('@contract shows the action-required badge while collapsed and needing assignment', () => {
    render(
      <BookingDialogMobileTableAssignmentSection
        {...makeShared()}
        enabled={false}
        isOpen={false}
        needsAssignment
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Table Assignment')).toBeInTheDocument();
    expect(screen.getByText('Action required')).toBeInTheDocument();
    expect(screen.queryByTestId('table-assignment-panel')).not.toBeInTheDocument();
  });

  it('@contract expanding requests the open state', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BookingDialogMobileTableAssignmentSection
        {...makeShared()}
        enabled={false}
        isOpen={false}
        needsAssignment={false}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Table Assignment/ }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('@contract mounts the lazy panel once open', async () => {
    render(
      <BookingDialogMobileTableAssignmentSection
        {...makeShared()}
        enabled
        isOpen
        needsAssignment={false}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('table-assignment-panel')).toBeInTheDocument();
    });
    expect(screen.queryByText('Action required')).not.toBeInTheDocument();
  });

  it('@contract shows the locked alert when assignments are disallowed', async () => {
    render(
      <BookingDialogMobileTableAssignmentSection
        {...makeShared()}
        allowTableAssignments={false}
        enabled
        isOpen
        needsAssignment={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(await screen.findByText('Table assignment disabled')).toBeInTheDocument();
    expect(
      screen.getByText('Assignments are locked for past or completed bookings.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('table-assignment-panel')).not.toBeInTheDocument();
  });
});

describe('BookingDialogDesktopTableAssignmentSection', () => {
  it('@contract renders the section heading and mounts the lazy panel', async () => {
    render(
      <BookingDialogDesktopTableAssignmentSection
        {...makeShared()}
        queryEnabled
      />,
    );

    expect(screen.getByText('Table Assignment')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('table-assignment-panel')).toBeInTheDocument();
    });
    // The panel query stays disabled until the 180 ms settle timer elapses.
    const forwarded = panelSpy.mock.calls.at(0)?.[0] as { enabled: boolean };
    expect(forwarded.enabled).toBe(false);
  });
});
