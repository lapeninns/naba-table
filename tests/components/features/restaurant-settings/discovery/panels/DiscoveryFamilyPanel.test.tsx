import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiscoveryFamilyPanel } from '@/components/features/restaurant-settings/discovery/panels/DiscoveryFamilyPanel';

describe('DiscoveryFamilyPanel', () => {
  it('@smoke stacks its children in the panel layout', () => {
    render(
      <DiscoveryFamilyPanel>
        <p>First block</p>
        <p>Second block</p>
      </DiscoveryFamilyPanel>,
    );

    expect(screen.getByText('First block')).toBeInTheDocument();
    expect(screen.getByText('Second block')).toBeInTheDocument();
  });
});
