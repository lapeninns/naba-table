import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsSectionHeader } from '@/components/features/restaurant-settings/shared/SettingsSectionHeader';

describe('SettingsSectionHeader', () => {
  it('@smoke @a11y renders the section heading with description and action slot', () => {
    render(
      <SettingsSectionHeader
        title="Service windows"
        description="Lunch and dinner sessions."
        action={<button type="button">Add window</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Service windows' })).toBeInTheDocument();
    expect(screen.getByText('Lunch and dinner sessions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add window' })).toBeInTheDocument();
  });
});
