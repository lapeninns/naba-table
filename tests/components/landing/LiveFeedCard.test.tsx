import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveFeedCard } from '@/components/landing/shared/LiveFeedCard';

describe('LiveFeedCard', () => {
  it('@smoke renders the service board header with the live badge', () => {
    render(<LiveFeedCard />);

    expect(screen.getByText(/service board/i)).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('@smoke lists the floor zones with their tables', () => {
    render(<LiveFeedCard />);

    for (const zone of ['Bar', 'Dining', 'Snug']) {
      expect(screen.getByText(zone)).toBeInTheDocument();
    }
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T9')).toBeInTheDocument();
  });

  it('@smoke shows the reservation timeline and summary strip', () => {
    render(<LiveFeedCard />);

    expect(screen.getByText('18:30 - 4 guests')).toBeInTheDocument();
    expect(screen.getByText('Reminder sent')).toBeInTheDocument();
    expect(screen.getByText('Waitlist ready')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8 sent')).toBeInTheDocument();
  });
});
