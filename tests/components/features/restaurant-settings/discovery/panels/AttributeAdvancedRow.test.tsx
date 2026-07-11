import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AttributeAdvancedRow } from '@/components/features/restaurant-settings/discovery/panels/AttributeAdvancedRow';

import { makeAttributeRow, makeBusinessContextEditor } from '../../testUtils';

import type { AttributeEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeAttributeRow(rowOver) as AttributeEditor;
  render(
    <AttributeAdvancedRow row={row} editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return { editor, row };
}

describe('AttributeAdvancedRow', () => {
  it('@smoke renders the row title with grouped-amenity subtitle for catalog keys', () => {
    renderRow();

    expect(screen.getByText('Shown in grouped amenities')).toBeInTheDocument();
    expect(screen.getByLabelText('Key')).toHaveValue('has_wifi');
  });

  it('@contract edits a text field and removes the row', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ attributeGroup: '' });

    await user.type(screen.getByLabelText('Group'), 'A');
    expect(editor.updateAttribute).toHaveBeenCalledWith(row.id, 'attributeGroup', 'A');

    await user.click(screen.getByRole('button', { name: /Remove/ }));
    expect(editor.removeAttribute).toHaveBeenCalledWith(row.id);
  });
});
