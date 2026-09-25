import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceItemsPanel } from '@/components/features/restaurant-settings/discovery/panels/ServiceItemsPanel';

import { makeBusinessContextEditor, makeServiceItemRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderPanel(over: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor(over);
  renderWithDiscoveryForm(
    <ServiceItemsPanel editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return editor;
}

describe('ServiceItemsPanel', () => {
  it('@smoke shows the empty state and adds a service', async () => {
    const user = userEvent.setup();
    const editor = renderPanel();

    expect(screen.getByText('No services')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    expect(editor.addServiceItem).toHaveBeenCalledTimes(1);
  });

  it('@a11y returns focus to Add service after removing one', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({ serviceItems: [makeServiceItemRow()] });

    await user.click(screen.getByRole('button', { name: 'Remove Sunday roast' }));

    expect(editor.removeServiceItem).toHaveBeenCalledWith('service-item-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add service' })).toHaveFocus());
  });
});
