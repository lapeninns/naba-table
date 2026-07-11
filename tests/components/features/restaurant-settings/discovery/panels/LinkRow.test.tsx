import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LinkRow } from '@/components/features/restaurant-settings/discovery/panels/LinkRow';

import { makeBusinessContextEditor, makeLinkRow } from '../../testUtils';

import type { LinkEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeLinkRow(rowOver) as LinkEditor;
  render(<LinkRow row={row} editor={editor as unknown as RestaurantBusinessContextEditor} />);
  return { editor, row };
}

describe('LinkRow', () => {
  it('@smoke @a11y renders labelled type, label, and URL fields', () => {
    renderRow();

    expect(screen.getByRole('combobox', { name: 'Link type' })).toBeInTheDocument();
    expect(screen.getByLabelText('Label')).toHaveValue('Website');
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com');
    expect(screen.getByRole('switch', { name: 'Primary' })).not.toBeChecked();
  });

  it('@contract edits the URL field', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ url: '' });

    await user.type(screen.getByLabelText('URL'), 'h');

    expect(editor.updateLink).toHaveBeenCalledWith(row.id, 'url', 'h');
  });

  it('@contract toggles the primary flag and removes the link', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow();

    await user.click(screen.getByRole('switch', { name: 'Primary' }));
    expect(editor.updateLink).toHaveBeenCalledWith(row.id, 'isPrimary', true);

    await user.click(screen.getByRole('button', { name: 'Remove Website' }));
    expect(editor.removeLink).toHaveBeenCalledWith(row.id);
  });
});
