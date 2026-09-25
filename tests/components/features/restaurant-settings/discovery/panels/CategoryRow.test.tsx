import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CategoryRow } from '@/components/features/restaurant-settings/discovery/panels/CategoryRow';

import { makeBusinessContextEditor, makeCategoryRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { CategoryEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeCategoryRow(rowOver) as CategoryEditor;
  renderWithDiscoveryForm(
    <CategoryRow row={row} editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return { editor, row };
}

describe('CategoryRow', () => {
  it('@smoke groups the advanced fields under the category name', () => {
    renderRow();

    expect(screen.getByRole('group', { name: 'Gastropub' })).toBeInTheDocument();
    expect(screen.getByLabelText('Category code')).toHaveValue('gastropub');
  });

  it('@contract edits the name and code', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow();

    await user.type(screen.getByLabelText('Category name'), '!');
    expect(editor.updateCategory).toHaveBeenCalledWith(row.id, 'displayName', 'Gastropub!');
  });

  it('@contract commits more-hours types on Enter', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ moreHoursTypeDraft: 'kitchen hours' });

    screen.getByLabelText('More-hours types').focus();
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

    await user.click(screen.getByRole('button', { name: 'Remove HAPPY_HOUR' }));

    expect(editor.removeMoreHoursType).toHaveBeenCalledWith(row.id, 0);
  });
});
