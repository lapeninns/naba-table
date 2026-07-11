import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceItemsPanel } from '@/components/features/restaurant-settings/discovery/panels/ServiceItemsPanel';

import { makeBusinessContextEditor, makeServiceItemRow } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

describe('ServiceItemsPanel', () => {
  it('@smoke renders a row per service item with the add action', () => {
    const editor = makeBusinessContextEditor({ serviceItems: [makeServiceItemRow()] });
    render(
      <ServiceItemsPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    expect(screen.getByText('Sunday roast')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add service item/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save service items' })).toBeDisabled();
  });

  it('@contract adds a service item through the panel action', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor();
    render(
      <ServiceItemsPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Add service item/ }));

    expect(editor.addServiceItem).toHaveBeenCalledTimes(1);
  });
});
