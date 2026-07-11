import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LinksPanel } from '@/components/features/restaurant-settings/discovery/panels/LinksPanel';

import { makeBusinessContextEditor, makeLinkRow } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

describe('LinksPanel', () => {
  it('@smoke renders a row per link with the add action', () => {
    const editor = makeBusinessContextEditor({ links: [makeLinkRow()] });
    render(
      <LinksPanel embedded={false} editor={editor as unknown as RestaurantBusinessContextEditor} />,
    );

    expect(screen.getByRole('button', { name: /Add link/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save links' })).toBeDisabled();
  });

  it('@contract adds a link through the panel action', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor();
    render(
      <LinksPanel embedded={false} editor={editor as unknown as RestaurantBusinessContextEditor} />,
    );

    await user.click(screen.getByRole('button', { name: /Add link/ }));

    expect(editor.addLink).toHaveBeenCalledTimes(1);
  });
});
