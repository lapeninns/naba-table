import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { BookingStatCard } from '@/components/features/dashboard/booking-details/components/BookingStatCard';

describe('BookingStatCard', () => {
  it('@smoke renders label, value, and subtext', () => {
    render(<BookingStatCard icon={Users} label="Party" value={6} subtext="2 children" />);

    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('2 children')).toBeInTheDocument();
  });

  it('@smoke renders string values without a subtext row', () => {
    render(<BookingStatCard icon={Users} label="Time" value="18:00" />);

    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.queryByText('2 children')).not.toBeInTheDocument();
  });
});
