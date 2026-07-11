import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionTurnBandsSection } from '@/components/features/restaurant-settings/AvailabilityOccasionTurnBandsSection';
import { createEmptyOccasionForm } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

describe('AvailabilityOccasionTurnBandsSection', () => {
  it('@contract renders nothing when turn bands are not enabled', () => {
    const { container } = render(
      <AvailabilityOccasionTurnBandsSection
        editingKey={null}
        form={createEmptyOccasionForm()}
        showTurnBands={false}
        onFormChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('@smoke explains the per-party-size override with the default duration fallback', () => {
    render(
      <AvailabilityOccasionTurnBandsSection
        editingKey={null}
        form={createEmptyOccasionForm()}
        showTurnBands
        onFormChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Dining durations by party size')).toBeInTheDocument();
    expect(screen.getByText(/Override the default duration above/)).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
  });

  it('@smoke uses service-window copy when editing a service window occasion', () => {
    render(
      <AvailabilityOccasionTurnBandsSection
        editingKey="lunch"
        form={{ ...createEmptyOccasionForm(), label: 'Lunch' }}
        showTurnBands
        onFormChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/inside the Lunch service window/),
    ).toBeInTheDocument();
  });
});
