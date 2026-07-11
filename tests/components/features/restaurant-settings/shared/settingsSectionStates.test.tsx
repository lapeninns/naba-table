import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsSectionStates } from '@/components/features/restaurant-settings/shared/settingsSectionStates';

function renderStates(over: Partial<Parameters<typeof SettingsSectionStates>[0]> = {}) {
  render(
    <SettingsSectionStates
      restaurantId="rest-1"
      isLoading={false}
      error={null}
      noRestaurant={<p>Pick a restaurant</p>}
      loading={<p>Loading section</p>}
      errorState={(error) => <p>Failed: {error.message}</p>}
      {...over}
    >
      {(restaurantId) => <p>Loaded for {restaurantId}</p>}
    </SettingsSectionStates>,
  );
}

describe('SettingsSectionStates', () => {
  it('@contract renders the no-restaurant state without a restaurant id', () => {
    renderStates({ restaurantId: null });

    expect(screen.getByText('Pick a restaurant')).toBeInTheDocument();
  });

  it('@contract renders the loading state while pending', () => {
    renderStates({ isLoading: true });

    expect(screen.getByText('Loading section')).toBeInTheDocument();
  });

  it('@contract renders the error state with the error message', () => {
    renderStates({ error: new Error('Section fetch failed') });

    expect(screen.getByText('Failed: Section fetch failed')).toBeInTheDocument();
  });

  it('@contract renders the children with the resolved restaurant id', () => {
    renderStates();

    expect(screen.getByText('Loaded for rest-1')).toBeInTheDocument();
  });
});
