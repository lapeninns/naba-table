import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AttributeAdvancedRow } from '@/components/features/restaurant-settings/discovery/panels/AttributeAdvancedRow';

import { makeAttributeRow, makeBusinessContextEditor } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { AttributeEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const onRemove = vi.fn();
  const row = makeAttributeRow(rowOver) as AttributeEditor;
  renderWithDiscoveryForm(
    <AttributeAdvancedRow
      row={row}
      editor={editor as unknown as RestaurantBusinessContextEditor}
      onRemove={onRemove}
    />,
  );
  return { editor, row, onRemove };
}

describe('AttributeAdvancedRow', () => {
  it('@smoke notes when a catalogue amenity is also in the list above', () => {
    renderRow();

    expect(screen.getByText('Also shown in the amenity list above')).toBeInTheDocument();
    expect(screen.getByLabelText('Key')).toHaveValue('has_wifi');
  });

  it('@contract edits a text field and removes the row', async () => {
    const user = userEvent.setup();
    const { editor, row, onRemove } = renderRow({ attributeGroup: '' });

    await user.type(screen.getByLabelText('Group'), 'A');
    expect(editor.updateAttribute).toHaveBeenCalledWith(row.id, 'attributeGroup', 'A');

    await user.click(screen.getByRole('button', { name: 'Remove Wi-Fi' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
