import { render, screen } from '@testing-library/react';
import { Calendar, User } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
  BookingSidebarCard,
  DetailStatCard,
  InfoPanel,
  InlineAlert,
  ManageBookingPanel,
} from '@/components/features/booking/ui/BookingPanelComponents';

describe('BookingPanelComponents (presentational)', () => {
  it('@smoke renders DetailStatCard label, value, and optional subtext', () => {
    const { rerender } = render(
      <DetailStatCard icon={Calendar} label="Date" value="Wed 1 Jul" subtext="Wednesday, 1 July 2026" />,
    );

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Wed 1 Jul')).toBeInTheDocument();
    expect(screen.getByText('Wednesday, 1 July 2026')).toBeInTheDocument();

    rerender(<DetailStatCard icon={Calendar} label="Time" value="19:30" />);
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('19:30')).toBeInTheDocument();
  });

  it('@smoke renders InfoPanel title and every row label/value pair', () => {
    render(
      <InfoPanel
        title="Guest Information"
        rows={[
          { icon: User, label: 'Primary Guest', value: 'Alice Example' },
          { icon: User, label: 'Email', value: 'alice@example.com' },
        ]}
      />,
    );

    expect(screen.getByText('Guest Information')).toBeInTheDocument();
    expect(screen.getByText('Primary Guest')).toBeInTheDocument();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('@smoke renders ManageBookingPanel kicker, title, actions, and optional footer', () => {
    const { rerender } = render(
      <ManageBookingPanel title="Manage booking" actions={<button type="button">Modify</button>} />,
    );

    expect(screen.getByText('Booking actions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Manage booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modify' })).toBeInTheDocument();
    expect(screen.queryByText('footer note')).not.toBeInTheDocument();

    rerender(
      <ManageBookingPanel
        title="Manage booking"
        actions={<button type="button">Modify</button>}
        footer={<p>footer note</p>}
      />,
    );
    expect(screen.getByText('footer note')).toBeInTheDocument();
  });

  it('@smoke renders BookingSidebarCard children', () => {
    render(
      <BookingSidebarCard>
        <p>sidebar body</p>
      </BookingSidebarCard>,
    );

    expect(screen.getByText('sidebar body')).toBeInTheDocument();
  });

  it('@smoke renders InlineAlert content for each tone without throwing', () => {
    const { rerender } = render(<InlineAlert>Default message</InlineAlert>);
    expect(screen.getByText('Default message')).toBeInTheDocument();

    for (const tone of ['default', 'success', 'warning', 'danger', 'info'] as const) {
      rerender(<InlineAlert tone={tone}>{`${tone} message`}</InlineAlert>);
      expect(screen.getByText(`${tone} message`)).toBeInTheDocument();
    }
  });
});
