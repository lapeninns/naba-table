import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CategoryRow } from '@/components/features/restaurant-settings/discovery/panels/CategoryRow';

import { makeBusinessContextEditor, makeCategoryRow } from '../../testUtils';

import type { CategoryEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeCategoryRow(rowOver) as CategoryEditor;
  render(
    <CategoryRow row={row} editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return { editor, row };
}

describe('CategoryRow', () => {
  it('@smoke shows the category title with its Primary badge', () => {
    renderRow();

    expect(screen.getByText('Gastropub')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('@contract edits the display name field', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow();

    await user.type(screen.getByLabelText('Category name'), '!');

    expect(editor.updateCategory).toHaveBeenCalledWith(row.id, 'displayName', 'Gastropub!');
  });

  it('@contract removes the category', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Remove Gastropub' }));

    expect(editor.removeCategory).toHaveBeenCalledWith(row.id);
  });

  it('@contract toggles the primary flag', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ isPrimary: false });

    await user.click(screen.getByRole('switch', { name: 'Primary category' }));

    expect(editor.updateCategory).toHaveBeenCalledWith(row.id, 'isPrimary', true);
  });

  it('@contract commits more-hours types on Enter', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ moreHoursTypeDraft: 'kitchen hours' });

    const draftInput = screen.getByLabelText('More-hours types');
    draftInput.focus();
    await user.keyboard('{Enter}');

    expect(editor.addMoreHoursTypes).toHaveBeenCalledWith(row.id, 'kitchen hours');
  });

  it('@contract removes an existing more-hours type chip', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({
      moreHoursTypes: [
        { hoursTypeId: 'HAPPY_HOUR', displayName: 'Happy hour', localizedDisplayName: null },
      ],
    });

    // The chip label prefers the provider hoursTypeId.
    await user.click(screen.getByRole('button', { name: 'Remove HAPPY_HOUR' }));

    expect(editor.removeMoreHoursType).toHaveBeenCalledWith(row.id, 0);
  });
});
