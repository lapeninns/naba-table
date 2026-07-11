import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderOpsEmailDeliveryTableRows } from '@/components/features/email-delivery/components/OpsEmailDeliveryTableRows';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function makeAttempt(key: string, status: OpsEmailDeliveryAttemptDTO['currentStatus']) {
  return {
    messageId: key,
    recipientEmail: `${key}@example.com`,
    bookingId: null,
    emailType: 'created',
    templateType: 'booking_confirmation',
    provider: 'resend',
    currentStatus: status,
    currentOccurredAt: '2026-03-20T15:00:00Z',
    events: [],
    booking: null,
  } satisfies OpsEmailDeliveryAttemptDTO;
}

function makeRow(
  key: string,
  status: OpsEmailDeliveryAttemptDTO['currentStatus'],
  canRetry: boolean,
): OpsEmailDeliveryTableRowViewModel {
  return {
    attemptKey: key,
    attempt: makeAttempt(key, status),
    currentStatusLabel: status,
    subject: `Subject ${key}`,
    recipientEmail: `${key}@example.com`,
    emailType: 'created',
    bookingReference: 'REF001',
    customerName: 'Alex Johnson',
    sentAtLabel: 'Fri, Mar 20 · 15:00',
    sentAtMs: Date.parse('2026-03-20T15:00:00Z'),
    statusSortValue: status,
    canRetry,
  };
}

function renderRows(params: {
  rows: OpsEmailDeliveryTableRowViewModel[];
  expandedKey?: string | null;
  onRowClick?: (key: string) => void;
  onRetryAttempt?: (key: string) => void;
}) {
  return render(
    <table>
      <tbody>
        {renderOpsEmailDeliveryTableRows({
          expandedKey: params.expandedKey ?? null,
          onRetryAttempt: params.onRetryAttempt,
          onRowClick: params.onRowClick ?? vi.fn(),
          restaurantId: 'rest-1',
          rows: params.rows,
          timezone: 'UTC',
        })}
      </tbody>
    </table>,
  );
}

describe('renderOpsEmailDeliveryTableRows', () => {
  it('@contract renders one row per attempt with subject, recipient, booking, and sent-at cells', () => {
    renderRows({ rows: [makeRow('msg-1', 'delivered', false)] });

    const row = screen.getByRole('row');
    expect(within(row).getByText('Subject msg-1')).toBeInTheDocument();
    expect(within(row).getByText('msg-1@example.com')).toBeInTheDocument();
    expect(within(row).getByText('REF001')).toBeInTheDocument();
    expect(within(row).getByText('Alex Johnson')).toBeInTheDocument();
    expect(within(row).getByText('Fri, Mar 20 · 15:00')).toBeInTheDocument();
  });

  it('@contract reports row clicks through onRowClick with the attempt key', async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    renderRows({ rows: [makeRow('msg-1', 'delivered', false)], onRowClick });

    await user.click(screen.getByText('Subject msg-1'));

    expect(onRowClick).toHaveBeenCalledWith('msg-1');
  });

  it('@contract shows the retry action only for retryable rows and stops it propagating to the row click', async () => {
    const onRowClick = vi.fn();
    const onRetryAttempt = vi.fn();
    const user = userEvent.setup();
    renderRows({
      rows: [makeRow('msg-failed', 'failed', true), makeRow('msg-ok', 'delivered', false)],
      onRowClick,
      onRetryAttempt,
    });

    expect(
      screen.queryByRole('button', { name: 'Retry email for msg-ok@example.com' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Retry email for msg-failed@example.com' }),
    );

    expect(onRetryAttempt).toHaveBeenCalledWith('msg-failed');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('@contract appends an expanded detail row for the expanded attempt only', () => {
    renderRows({
      rows: [makeRow('msg-1', 'failed', false), makeRow('msg-2', 'delivered', false)],
      expandedKey: 'msg-1',
    });

    const rows = screen.getAllByRole('row');
    // Two attempt rows plus one detail row.
    expect(rows).toHaveLength(3);
    expect(screen.getByText('Event Timeline')).toBeInTheDocument();
    expect(screen.getByText('msg-1', { selector: '.font-mono' })).toBeInTheDocument();
  });
});
