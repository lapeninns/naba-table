import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { BusinessDetailsPanel } from '@/components/features/restaurant-settings/discovery/panels/BusinessDetailsPanel';

import { makeBusinessContextEditor } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderPanel() {
  const editor = makeBusinessContextEditor();
  renderWithDiscoveryForm(
    <BusinessDetailsPanel editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return editor;
}

describe('BusinessDetailsPanel', () => {
  it('@smoke shows status and opening date; the service-location switch lives in Where you serve', () => {
    renderPanel();

    expect(screen.getByRole('combobox', { name: 'Business status' })).toHaveTextContent('Open');
    expect(screen.getByText('Opening date')).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'We serve customers at their location' }),
    ).not.toBeInTheDocument();
  });

  it('@contract routes status changes to the editor', async () => {
    const user = userEvent.setup();
    const editor = renderPanel();

    await user.click(screen.getByRole('combobox', { name: 'Business status' }));
    await user.click(await screen.findByRole('option', { name: 'Closed temporarily' }));
    expect(editor.updateBusinessDetails).toHaveBeenCalledWith(
      'businessStatus',
      'closed_temporarily',
    );
  });
});
