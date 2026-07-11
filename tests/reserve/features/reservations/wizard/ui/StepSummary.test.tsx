import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { StepSummary } from '@features/reservations/wizard/ui/StepSummary';

describe('StepSummary', () => {
  it('renders the primary line and bullet-joined details @smoke', () => {
    render(
      <StepSummary summary={{ primary: 'Dinner', details: ['4 guests', '19:00', 'Apr 14 2026'] }} />,
    );

    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText('4 guests • 19:00 • Apr 14 2026')).toBeInTheDocument();
  });

  it('falls back to a date prompt when the primary is blank @contract', () => {
    render(<StepSummary summary={{ primary: '   ', details: [] }} />);
    expect(screen.getByText('Select your date')).toBeInTheDocument();
  });

  it('skips the detail row when there is nothing to show @smoke', () => {
    const { container } = render(<StepSummary summary={{ primary: 'Dinner', details: ['', ''] }} />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
