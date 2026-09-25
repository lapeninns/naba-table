import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ServiceItemRow } from '@/components/features/restaurant-settings/discovery/panels/ServiceItemRow';

import { makeBusinessContextEditor, makeServiceItemRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { ServiceItemEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const onRemove = vi.fn();
  const row = makeServiceItemRow(rowOver) as ServiceItemEditor;
  renderWithDiscoveryForm(
    <ServiceItemRow
      row={row}
      editor={editor as unknown as RestaurantBusinessContextEditor}
      onRemove={onRemove}
    />,
  );
  return { editor, row, onRemove };
}

describe('ServiceItemRow', () => {
  it('@smoke shows name and description, with the code under Advanced', async () => {
    const user = userEvent.setup();
    renderRow();

    expect(screen.getByLabelText('Service')).toHaveValue('Sunday roast');
    expect(screen.getByLabelText(/Description/)).toHaveValue('Weekly roast service');
    expect(screen.queryByLabelText('Service code')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Service code and details/ }));
    expect(screen.getByLabelText('Service code')).toHaveValue('sunday-roast');
  });

  it('@contract routes edits and removal', async () => {
    const user = userEvent.setup();
    const { editor, row, onRemove } = renderRow({ description: '' });

    await user.type(screen.getByLabelText(/Description/), 'R');
    expect(editor.updateServiceItem).toHaveBeenCalledWith(row.id, 'description', 'R');
    await user.click(screen.getByRole('button', { name: 'Remove Sunday roast' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
