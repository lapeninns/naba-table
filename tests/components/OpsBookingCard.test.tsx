import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryClientMock, useBookingServiceMock, useMediaQueryMock, useMinimumDelayMock } =
  vi.hoisted(() => ({
    queryClientMock: {
      prefetchQuery: vi.fn(),
      setQueryData: vi.fn(),
    },
    useBookingServiceMock: vi.fn(() => ({
      getDialogBundle: vi.fn(),
    })),
    useMediaQueryMock: vi.fn(() => false),
    useMinimumDelayMock: vi.fn((value: boolean) => value),
  }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQueryClient: () => queryClientMock,
  };
});

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: useBookingServiceMock,
}));

vi.mock('@src/hooks/useMediaQuery', () => ({
  useMediaQuery: useMediaQueryMock,
}));

vi.mock('@src/hooks/use-minimum-delay', () => ({
  useMinimumDelay: useMinimumDelayMock,
}));

import { OpsBookingCard } from '@/components/features/dashboard/cards/OpsBookingCard';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';

import type { BookingDTO } from '@/hooks/useBookings';

function createBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: overrides.id ?? 'booking-abcdef12',
    restaurantName: overrides.restaurantName ?? 'Old Crown',
    partySize: overrides.partySize ?? 2,
    startIso: overrides.startIso ?? '2026-03-29T18:00:00.000Z',
    endIso: overrides.endIso ?? '2026-03-29T19:30:00.000Z',
    status: overrides.status ?? 'confirmed',
    customerName: overrides.customerName ?? 'Alex Example',
    customerEmail: overrides.customerEmail ?? null,
    customerPhone: overrides.customerPhone ?? null,
    notes: overrides.notes ?? null,
    reservationIntervalMinutes: overrides.reservationIntervalMinutes ?? null,
    reference: overrides.reference ?? null,
    source: overrides.source ?? null,
    seatingPreference: overrides.seatingPreference ?? null,
    allergies: overrides.allergies ?? null,
    dietaryRestrictions: overrides.dietaryRestrictions ?? null,
    tableAssignments: overrides.tableAssignments ?? [],
    requiresTableAssignment: overrides.requiresTableAssignment ?? true,
    checkedInAt: overrides.checkedInAt ?? null,
    checkedOutAt: overrides.checkedOutAt ?? null,
    displayTimeRangeLabel: overrides.displayTimeRangeLabel ?? null,
    displayCustomerLabel: overrides.displayCustomerLabel ?? null,
    displayInitials: overrides.displayInitials ?? null,
    searchText: overrides.searchText ?? null,
    tableLabel: overrides.tableLabel ?? null,
    ...overrides,
  };
}

function renderCard(overrides: Partial<BookingDTO> = {}) {
  const viewModel = buildOpsBookingCardViewModel({
    booking: createBooking(overrides),
    timezone: 'UTC',
    now: new Date('2026-03-29T17:30:00.000Z'),
    actionsDisabled: false,
  });

  return render(<OpsBookingCard viewModel={viewModel} />);
}

function renderLockedCard(overrides: Partial<BookingDTO> = {}) {
  const viewModel = buildOpsBookingCardViewModel({
    booking: createBooking(overrides),
    timezone: 'UTC',
    now: new Date('2026-03-29T17:30:00.000Z'),
    pendingAction: 'check-in',
    actionsDisabled: true,
  });

  return render(<OpsBookingCard viewModel={viewModel} />);
}

function getCardTrigger() {
  const trigger = screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-controls')?.startsWith('ops-booking-details-'));
  expect(trigger).toBeDefined();
  return trigger!;
}

describe('OpsBookingCard', () => {
  beforeEach(() => {
    useMediaQueryMock.mockReturnValue(false);
    useMinimumDelayMock.mockImplementation((value: boolean) => value);
  });

  it('renders desktop details with contact and reference fallbacks', () => {
    renderCard({
      id: 'abcdef123456',
      customerPhone: '   ',
      customerEmail: '\n',
      notes: '   ',
      reference: '   ',
    });

    expect(screen.queryByRole('button', { name: /toggle details/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/available\. expand details to read\./i)).not.toBeInTheDocument();
    expect(screen.getByText('No contact')).toBeInTheDocument();
    expect(screen.getByText('Ref abcdef12')).toBeInTheDocument();
    expect(screen.getByText('No special requests.')).toBeInTheDocument();
  });

  it('renders canonical table states', () => {
    const { rerender } = render(
      <OpsBookingCard
        viewModel={buildOpsBookingCardViewModel({
          booking: createBooking({
            tableAssignments: [
              {
                groupId: 'group-1',
                capacitySum: 4,
                members: [
                  { tableId: 't-1', tableNumber: '12', capacity: 2, section: 'Main' },
                  { tableId: 't-2', tableNumber: '14', capacity: 2, section: 'Main' },
                ],
              },
            ],
          }),
          timezone: 'UTC',
          now: new Date('2026-03-29T17:30:00.000Z'),
          actionsDisabled: false,
        })}
      />,
    );

    expect(screen.getAllByText('Table 12 + 14')).toHaveLength(2);

    rerender(
      <OpsBookingCard
        viewModel={buildOpsBookingCardViewModel({
          booking: createBooking({
            tableAssignments: [],
          }),
          timezone: 'UTC',
          now: new Date('2026-03-29T17:30:00.000Z'),
          actionsDisabled: false,
        })}
      />,
    );

    expect(screen.getAllByText('Unassigned')).toHaveLength(2);

    rerender(
      <OpsBookingCard
        viewModel={buildOpsBookingCardViewModel({
          booking: createBooking({
            status: 'completed',
            tableAssignments: [],
          }),
          timezone: 'UTC',
          now: new Date('2026-03-29T17:30:00.000Z'),
          actionsDisabled: false,
        })}
      />,
    );

    expect(screen.getAllByText('N/A')).toHaveLength(2);
  });

  it('uses singular and plural guest labels in the header', () => {
    const { rerender } = renderCard({ partySize: 1 });

    expect(screen.getByText('1 Guest')).toBeInTheDocument();

    rerender(
      <OpsBookingCard
        viewModel={buildOpsBookingCardViewModel({
          booking: createBooking({ partySize: 4 }),
          timezone: 'UTC',
          now: new Date('2026-03-29T17:30:00.000Z'),
          actionsDisabled: false,
        })}
      />,
    );

    expect(screen.getByText('4 Guests')).toBeInTheDocument();
  });

  it('shows the mobile notes hint only while notes exist and the card is collapsed', async () => {
    const user = userEvent.setup();
    useMediaQueryMock.mockReturnValue(true);

    renderCard({ notes: '  Birthday candles  ' });

    expect(screen.getByText(/available\. expand details to read\./i)).toBeInTheDocument();

    await user.click(getCardTrigger());

    expect(screen.queryByText(/available\. expand details to read\./i)).not.toBeInTheDocument();
  });

  it('does not show the mobile notes hint when normalized notes are empty', () => {
    useMediaQueryMock.mockReturnValue(true);

    renderCard({ notes: '   ' });

    expect(screen.queryByText(/available\. expand details to read\./i)).not.toBeInTheDocument();
  });

  it('marks locked cards as inert and disables details actions', () => {
    useMediaQueryMock.mockReturnValue(true);

    renderLockedCard();

    const lockedCard = screen.getByText('Alex Example').closest('[aria-disabled="true"]');

    expect(lockedCard).not.toBeNull();
    expect(lockedCard).toHaveClass('pointer-events-none');
    expect(screen.getByRole('button', { name: /^details$/i })).toBeDisabled();
  });
});
