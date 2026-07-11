import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LocationPickerCard } from '@/components/features/restaurant-settings/google-business-profile/components/LocationPickerCard';
import { buildLocationValue } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileConnectionModel';

import { makeGbpConnection } from '../../testUtils';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

function renderPicker(over: Partial<Parameters<typeof LocationPickerCard>[0]> = {}) {
  const data = makeGbpConnection() as unknown as GoogleBusinessProfileConnection;
  const selectedLocation = data.availableLocations[0] as GoogleBusinessProfileAvailableLocation;
  const handlers = {
    onConnect: vi.fn(),
    onSelectedLocationValueChange: vi.fn(),
    onLinkLocation: vi.fn(),
    onRetryLocations: vi.fn(),
  };
  render(
    <LocationPickerCard
      data={data}
      isConnecting={false}
      selectedLocation={selectedLocation}
      selectedLocationValue={buildLocationValue(selectedLocation)}
      isLinking={false}
      hasLinkedLocation={false}
      locationsErrorMessage={null}
      isRetryingLocations={false}
      locationsArePossiblyStale={false}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('LocationPickerCard', () => {
  it('@contract shows the authorized account with the selected location details', () => {
    renderPicker();

    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('1 High Street, Girton')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Preview on Google/ })).toBeInTheDocument();
  });

  it('@contract links the selected location', async () => {
    const user = userEvent.setup();
    const { onLinkLocation } = renderPicker();

    await user.click(screen.getByRole('button', { name: /Link location/ }));

    expect(onLinkLocation).toHaveBeenCalledTimes(1);
  });

  it('@contract offers reconnect when reauth is required', async () => {
    const user = userEvent.setup();
    const { onConnect } = renderPicker({
      data: makeGbpConnection({ status: 'reauth_required' }) as unknown as GoogleBusinessProfileConnection,
    });

    expect(screen.getByText('Reconnect required')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reconnect Google' }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('@contract retries a failed locations refresh', async () => {
    const user = userEvent.setup();
    const { onRetryLocations } = renderPicker({
      locationsErrorMessage: 'Could not refresh locations.',
    });

    expect(screen.getByText('Location refresh failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry locations' }));
    expect(onRetryLocations).toHaveBeenCalledTimes(1);
  });

  it('@contract explains when the account exposes no locations', () => {
    renderPicker({
      data: makeGbpConnection({ availableLocations: [] }) as unknown as GoogleBusinessProfileConnection,
      selectedLocation: null,
      selectedLocationValue: '',
    });

    expect(screen.getByText('No accessible locations')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
