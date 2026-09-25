import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LinksPanel } from '@/components/features/restaurant-settings/discovery/panels/LinksPanel';

import { makeBusinessContextEditor, makeLinkRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderPanel(over: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor(over);
  renderWithDiscoveryForm(
    <LinksPanel editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return editor;
}

describe('LinksPanel', () => {
  it('@smoke shows an empty state and adds a link', async () => {
    const user = userEvent.setup();
    const editor = renderPanel();

    expect(screen.getByText('No links yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    expect(editor.addLink).toHaveBeenCalledTimes(1);
  });

  it('@a11y returns focus to Add link after removing a link', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({ links: [makeLinkRow()] });

    await user.click(screen.getByRole('button', { name: 'Remove Website link' }));

    expect(editor.removeLink).toHaveBeenCalledWith('link-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add link' })).toHaveFocus());
  });
});
