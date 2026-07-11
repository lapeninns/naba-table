import { render, screen } from '@testing-library/react';
import { CheckCircle2, Info } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
  BookingDetailShell,
  BookingMessageShell,
  BookingSummaryCard,
} from '@/components/features/booking/ui/BookingShellComponents';

describe('BookingShellComponents (presentational)', () => {
  it('@smoke renders BookingDetailShell children', () => {
    render(
      <BookingDetailShell>
        <p>shell body</p>
      </BookingDetailShell>,
    );

    expect(screen.getByText('shell body')).toBeInTheDocument();
  });

  it('@smoke @a11y renders BookingMessageShell heading, description, and actions', () => {
    render(
      <BookingMessageShell
        icon={Info}
        title="Booking not found"
        description="We could not locate this reservation."
        actions={<button type="button">Back to dashboard</button>}
        tone="warning"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Booking not found' })).toBeInTheDocument();
    expect(screen.getByText('We could not locate this reservation.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to dashboard' })).toBeInTheDocument();
  });

  it('@smoke @a11y renders BookingSummaryCard title, reference, status badge, and back link', () => {
    render(
      <BookingSummaryCard
        title="The Fox"
        reference="NB1234"
        description="Update, share, or download your booking in one place."
        backHref="/guest/dashboard"
        status={{ icon: CheckCircle2, label: 'Confirmed', tone: 'success' }}
        actions={<button type="button">Download PDF</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'The Fox' })).toBeInTheDocument();
    expect(screen.getByText('NB1234')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/guest/dashboard');
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByText('Reference')).toBeInTheDocument();
  });

  it('@smoke renders the offline notice slot only when provided', () => {
    const { rerender } = render(
      <BookingSummaryCard
        title="The Fox"
        reference="NB1234"
        status={{ icon: CheckCircle2, label: 'Confirmed' }}
      />,
    );

    expect(screen.queryByText('You are offline')).not.toBeInTheDocument();

    rerender(
      <BookingSummaryCard
        title="The Fox"
        reference="NB1234"
        status={{ icon: CheckCircle2, label: 'Confirmed' }}
        offlineNotice={<p>You are offline</p>}
      />,
    );

    expect(screen.getByText('You are offline')).toBeInTheDocument();
  });
});
