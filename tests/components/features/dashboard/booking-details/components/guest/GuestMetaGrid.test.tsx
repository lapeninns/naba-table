import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestMetaGrid } from '@/components/features/dashboard/booking-details/components/guest/GuestMetaGrid';

describe('GuestMetaGrid', () => {
  it('@smoke renders covers, timing with duration, source, and event tiles', () => {
    render(
      <GuestMetaGrid
        partySize={4}
        formattedStartTime="18:00"
        durationMinutes={90}
        sourceLabel="Web"
        occasionLabel="Birthday"
      />,
    );

    expect(screen.getByText('Covers')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('18:00 · 90m')).toBeInTheDocument();
    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(screen.getByText('Birthday')).toBeInTheDocument();
  });

  it('@smoke omits the duration suffix when unknown', () => {
    render(
      <GuestMetaGrid
        partySize={2}
        formattedStartTime="19:30"
        durationMinutes={null}
        sourceLabel="Walk-in"
        occasionLabel="None"
      />,
    );

    expect(screen.getByText('19:30')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
