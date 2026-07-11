import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScheduleDayClosedNotice } from '@/components/features/restaurant-settings/availability/ScheduleDayClosedNotice';

describe('ScheduleDayClosedNotice', () => {
  it('@smoke explains that the closed day needs Open Day enabled', () => {
    render(<ScheduleDayClosedNotice />);

    expect(screen.getByText(/The kitchen is closed on this day/)).toBeInTheDocument();
    expect(screen.getByText(/Enable "Open Day"/)).toBeInTheDocument();
  });
});
