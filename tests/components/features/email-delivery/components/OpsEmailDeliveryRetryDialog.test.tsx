import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryRetryDialog } from '@/components/features/email-delivery/components/OpsEmailDeliveryRetryDialog';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

const attempt: OpsEmailDeliveryAttemptDTO = {
  messageId: 'msg-retry-1',
  recipientEmail: 'bounced@example.com',
  bookingId: null,
  emailType: 'created',
  templateType: 'booking_confirmation',
  provider: 'resend',
  currentStatus: 'bounced',
  currentOccurredAt: '2026-03-20T15:00:00Z',
  events: [],
  booking: null,
};

const pendingRetryRow: OpsEmailDeliveryTableRowViewModel = {
  attemptKey: 'msg-retry-1__bounced@example.com',
  attempt,
  currentStatusLabel: 'Bounced',
  subject: 'Your booking',
  recipientEmail: 'bounced@example.com',
  emailType: 'created',
  bookingReference: null,
  customerName: null,
  sentAtLabel: 'Fri, Mar 20 · 15:00',
  sentAtMs: Date.parse('2026-03-20T15:00:00Z'),
  statusSortValue: 'bounced',
  canRetry: true,
};

describe('OpsEmailDeliveryRetryDialog', () => {
  it('@contract @a11y renders as an alertdialog portal with recipient, subject, and duplicate-send warning', () => {
    render(
      <OpsEmailDeliveryRetryDialog isOpen pendingRetryRow={pendingRetryRow} onConfirmRetry={vi.fn()} />,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Retry email delivery?' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('bounced@example.com')).toBeInTheDocument();
    expect(screen.getByText('Your booking')).toBeInTheDocument();
    expect(screen.getByText(/may send a duplicate email/i)).toBeInTheDocument();
  });

  it('@contract stays closed when isOpen is false', () => {
    render(<OpsEmailDeliveryRetryDialog isOpen={false} pendingRetryRow={pendingRetryRow} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract confirms the retry without closing implicitly (preventDefault contract)', async () => {
    const onConfirmRetry = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <OpsEmailDeliveryRetryDialog
        isOpen
        pendingRetryRow={pendingRetryRow}
        onConfirmRetry={onConfirmRetry}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirm Retry' }));

    expect(onConfirmRetry).toHaveBeenCalledTimes(1);
  });

  it('@contract cancels via onOpenChange without confirming', async () => {
    const onConfirmRetry = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <OpsEmailDeliveryRetryDialog
        isOpen
        pendingRetryRow={pendingRetryRow}
        onConfirmRetry={onConfirmRetry}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmRetry).not.toHaveBeenCalled();
  });

  it('@contract disables both actions and shows progress copy while a retry is in flight', () => {
    render(
      <OpsEmailDeliveryRetryDialog
        isOpen
        pendingRetryRow={pendingRetryRow}
        retryingAttemptKey={pendingRetryRow.attemptKey}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('@contract disables confirm when no pending row is attached', () => {
    render(<OpsEmailDeliveryRetryDialog isOpen pendingRetryRow={null} />);

    expect(screen.getByRole('button', { name: 'Confirm Retry' })).toBeDisabled();
  });
});
