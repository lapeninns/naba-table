import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsNoRestaurantState } from '@/components/features/restaurant-settings/shared/SettingsNoRestaurantState';

describe('SettingsNoRestaurantState', () => {
  it('@contract titles the state and finishes the sentence with the task', () => {
    render(<SettingsNoRestaurantState task="edit its public details" />);

    expect(screen.getByRole('heading', { name: 'Select a restaurant' })).toBeInTheDocument();
    expect(
      screen.getByText('Choose a restaurant with the sidebar switcher to edit its public details.'),
    ).toBeInTheDocument();
  });

  it('@contract falls back to a generic task and accepts a full description', () => {
    const { rerender } = render(<SettingsNoRestaurantState />);
    expect(
      screen.getByText('Choose a restaurant with the sidebar switcher to manage its settings.'),
    ).toBeInTheDocument();

    rerender(<SettingsNoRestaurantState description="Pick a venue first." />);
    expect(screen.getByText('Pick a venue first.')).toBeInTheDocument();
  });
});
