import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';

describe('SettingsCard', () => {
  it('@smoke renders the title, description, and content', () => {
    render(
      <SettingsCard title="Booking rules" description="Slot rhythm and policy.">
        <p>Card body</p>
      </SettingsCard>,
    );

    expect(screen.getByText('Booking rules')).toBeInTheDocument();
    expect(screen.getByText('Slot rhythm and policy.')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('@contract renders optional header action and footer slots', () => {
    render(
      <SettingsCard
        title="Booking rules"
        headerAction={<button type="button">Header action</button>}
        footer={<p>Footer slot</p>}
      >
        <p>Card body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole('button', { name: 'Header action' })).toBeInTheDocument();
    expect(screen.getByText('Footer slot')).toBeInTheDocument();
  });
});
