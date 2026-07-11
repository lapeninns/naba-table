import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GbpLocationPickerSection } from '@/components/features/restaurant-settings/google-business-profile/sections/GbpLocationPickerSection';

import { makeGbpConnection } from '../../testUtils';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

describe('GbpLocationPickerSection', () => {
  it('@smoke anchors the location picker card for in-page navigation', () => {
    render(
      <GbpLocationPickerSection
        data={makeGbpConnection() as unknown as GoogleBusinessProfileConnection}
        selectedLocation={null}
        selectedLocationValue=""
        onSelectedLocationValueChange={vi.fn()}
        onConnect={vi.fn()}
        isConnecting={false}
        onLinkLocation={vi.fn()}
        isLinking={false}
        hasLinkedLocation={false}
        locationsErrorMessage={null}
        onRetryLocations={vi.fn()}
        isRetryingLocations={false}
        locationsArePossiblyStale={false}
      />,
    );

    expect(document.getElementById('gbp-location')).not.toBeNull();
    expect(screen.getByText('Choose a Business Profile location')).toBeInTheDocument();
  });
});
