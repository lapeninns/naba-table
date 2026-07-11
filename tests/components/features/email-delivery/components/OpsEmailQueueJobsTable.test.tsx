import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailQueueJobsTable } from '@/components/features/email-delivery/components/OpsEmailQueueJobsTable';

import type { OpsEmailQueueJobsTableProps } from '@/components/features/email-delivery/components/OpsEmailQueueJobsTable';
import type { OpsEmailQueueJobDTO } from '@/types/emailQueue';

const job: OpsEmailQueueJobDTO = {
  id: 'job-1',
  status: 'delayed',
  type: 'reminder_24h',
  bookingId: 'booking-1',
  restaurantId: 'rest-1',
  scheduledFor: '2026-03-20T15:00:00Z',
  failedReason: null,
  failedAt: null,
  attemptsMade: 2,
  booking: {
    id: 'booking-1',
    reference: 'REF001',
    customerName: 'Alex Johnson',
    customerEmail: 'alex@example.com',
    startAt: '2026-03-21T19:00:00Z',
    endAt: '2026-03-21T20:30:00Z',
    status: 'confirmed',
  },
};

function renderTable(overrides: Partial<OpsEmailQueueJobsTableProps> = {}) {
  const props: OpsEmailQueueJobsTableProps = {
    jobs: [job],
    page: 1,
    restaurantId: 'rest-1',
    timezone: 'UTC',
    total: 1,
    hasNext: false,
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    ...overrides,
  };
  return { ...render(<OpsEmailQueueJobsTable {...props} />), props };
}

describe('OpsEmailQueueJobsTable', () => {
  it('@contract renders the desktop table with status, type, reservation, guest, and pinned send time', () => {
    renderTable();

    // Mobile cards and desktop table are both in the JSDOM tree; scope to the table.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Queue Status')).toBeInTheDocument();
    expect(table.getByText('Scheduled')).toBeInTheDocument();
    expect(table.getByText('24-hour reminder')).toBeInTheDocument();
    expect(table.getByText('REF001')).toBeInTheDocument();
    expect(table.getByText('Alex Johnson')).toBeInTheDocument();
    expect(table.getByText('alex@example.com')).toBeInTheDocument();
    // Luxon formats with the explicit UTC zone regardless of host TZ.
    expect(table.getByText('Fri, Mar 20 · 15:00')).toBeInTheDocument();
    expect(table.getByText('Attempts: 2')).toBeInTheDocument();
    expect(table.getByRole('link', { name: 'Open booking' })).toHaveAttribute(
      'href',
      '/app/bookings?restaurantId=rest-1&focus=booking-1',
    );
  });

  it('@contract renders the same job as a mobile card outside the table', () => {
    renderTable();

    const table = screen.getByRole('table');
    const mobileArticle = screen
      .getAllByText('24-hour reminder')
      .map((node) => node.closest('article'))
      .find((article) => article !== null);

    expect(mobileArticle).not.toBeNull();
    expect(table.contains(mobileArticle as HTMLElement)).toBe(false);
    expect(within(mobileArticle as HTMLElement).getByText('Guest')).toBeInTheDocument();
    expect(within(mobileArticle as HTMLElement).getByText('REF001')).toBeInTheDocument();
  });

  it('@contract falls back to raw booking id and surfaces failure reasons for jobs without booking context', () => {
    renderTable({
      jobs: [
        {
          ...job,
          id: 'job-2',
          status: 'dlq',
          booking: null,
          failedReason: 'Provider timeout',
          attemptsMade: null,
        },
      ],
    });

    const table = within(screen.getByRole('table'));
    expect(table.getByText('booking-1')).toBeInTheDocument();
    expect(table.getByText('Unknown guest')).toBeInTheDocument();
    expect(table.getByText('Provider timeout')).toBeInTheDocument();
    expect(table.getByText('Needs attention')).toBeInTheDocument();
    expect(table.queryByText(/Attempts:/)).not.toBeInTheDocument();
  });

  it('@contract shows page context and disables Prev on the first page', () => {
    renderTable({ page: 1, total: 1, hasNext: false });

    expect(screen.getByText('Page 1 · 1 job')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('@contract pages forward and backward through the callbacks when available', async () => {
    const user = userEvent.setup();
    const { props } = renderTable({ page: 2, total: 60, hasNext: true });

    expect(screen.getByText('Page 2 · 60 jobs')).toBeInTheDocument();

    const prev = screen.getByRole('button', { name: 'Prev' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev).not.toBeDisabled();
    expect(next).not.toBeDisabled();

    await user.click(next);
    expect(props.onNextPage).toHaveBeenCalledTimes(1);

    await user.click(prev);
    expect(props.onPreviousPage).toHaveBeenCalledTimes(1);
  });
});
