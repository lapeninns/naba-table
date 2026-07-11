import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscoveryPanelsFrame } from '@/components/features/restaurant-settings/discovery/DiscoveryPanelsFrame';

import { makeBusinessContextEditor } from '../testUtils';

import type { FamilyKey } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function Panel({ family }: { family: FamilyKey }) {
  return <p>{family} panel content</p>;
}

function renderFrame({
  embedded = false,
  activeTab = 'links' as FamilyKey | '',
  editor = makeBusinessContextEditor(),
} = {}) {
  const onActiveTabChange = vi.fn();
  render(
    <DiscoveryPanelsFrame
      embedded={embedded}
      activeTab={activeTab}
      onActiveTabChange={onActiveTabChange}
      editor={editor as unknown as RestaurantBusinessContextEditor}
    >
      <Panel family="businessDetails" />
      <Panel family="links" />
    </DiscoveryPanelsFrame>,
  );
  return { onActiveTabChange };
}

describe('DiscoveryPanelsFrame', () => {
  it('@contract renders an accordion section per provided family child', () => {
    renderFrame();

    expect(screen.getByRole('button', { name: 'Profile basics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Online links' })).toBeInTheDocument();
    // Families without children are skipped entirely.
    expect(screen.queryByText('Dining categories')).not.toBeInTheDocument();
    // Active accordion tab exposes its panel content.
    expect(screen.getByText('links panel content')).toBeInTheDocument();
  });

  it('@contract reports accordion tab changes as family keys', async () => {
    const user = userEvent.setup();
    const { onActiveTabChange } = renderFrame({ activeTab: '' });

    await user.click(screen.getByRole('button', { name: 'Profile basics' }));

    expect(onActiveTabChange).toHaveBeenCalledWith('businessDetails');
  });

  it('@contract collapses to the embedded card layout with every child visible', () => {
    renderFrame({ embedded: true });

    expect(screen.getByRole('heading', { level: 3, name: 'Profile basics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Online links' })).toBeInTheDocument();
    expect(screen.getByText('businessDetails panel content')).toBeInTheDocument();
    expect(screen.getByText('links panel content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GBP workspace' })).toBeInTheDocument();
  });
});
