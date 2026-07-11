import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ShieldCheck } from 'lucide-react';

import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared/RestaurantSettingsCommandCenter';

function renderCenter(over: Partial<Parameters<typeof RestaurantSettingsCommandCenter>[0]> = {}) {
  render(
    <RestaurantSettingsCommandCenter
      eyebrow="Google command center"
      title="Google Business Profile"
      description="Connect Google for imports and comparisons."
      metrics={[
        {
          label: 'Connection',
          value: 'Linked',
          description: 'owner@example.com',
          Icon: ShieldCheck,
        },
      ]}
      railTitle="Google workflow"
      railItems={[{ label: 'Connection', onSelect: vi.fn(), isActive: true }]}
      footer={<span>Related settings live elsewhere.</span>}
      {...over}
    >
      <p>Workspace content</p>
    </RestaurantSettingsCommandCenter>,
  );
}

describe('RestaurantSettingsCommandCenter', () => {
  it('@smoke renders header, metrics, rail, footer, and children', () => {
    renderCenter();

    expect(screen.getByText('Google command center')).toBeInTheDocument();
    expect(screen.getByText('Google Business Profile')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    const rail = screen.getByRole('navigation', { name: 'Google workflow' });
    expect(within(rail).getByRole('button', { name: /Connection/ })).toBeInTheDocument();
    expect(screen.getByText('Related settings live elsewhere.')).toBeInTheDocument();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('@contract can hide the header and metrics for embedded use', () => {
    renderCenter({ showHeader: false });

    expect(screen.queryByText('Google command center')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked')).not.toBeInTheDocument();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('@contract routes rail selections and renders the primary action slot', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCenter({
      railItems: [{ label: 'Review changes', onSelect, badge: 'Next' }],
      primaryAction: <button type="button">Primary action</button>,
    });

    expect(screen.getByRole('button', { name: 'Primary action' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Review changes/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
