import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceItemRow } from '@/components/features/restaurant-settings/discovery/panels/ServiceItemRow';

import { makeBusinessContextEditor, makeServiceItemRow } from '../../testUtils';

import type { ServiceItemEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeServiceItemRow(rowOver) as ServiceItemEditor;
  render(
    <ServiceItemRow row={row} editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return { editor, row };
}

describe('ServiceItemRow', () => {
  it('@smoke renders the item title with its main fields', () => {
    renderRow();

    expect(screen.getByText('Sunday roast')).toBeInTheDocument();
    expect(screen.getByLabelText('Service code')).toHaveValue('sunday-roast');
    expect(screen.getByLabelText('Display name')).toHaveValue('Sunday roast');
  });

  it('@contract edits a main field and removes the row', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ description: '' });

    await user.type(screen.getByLabelText('Description'), 'X');
    expect(editor.updateServiceItem).toHaveBeenCalledWith(row.id, 'description', 'X');

    await user.click(screen.getByRole('button', { name: /Remove/ }));
    expect(editor.removeServiceItem).toHaveBeenCalledWith(row.id);
  });

  it('@contract reveals the advanced payload editor on demand', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow();

    expect(screen.queryByLabelText('Service details')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Advanced service data/ }));

    const payload = await screen.findByLabelText('Service details');
    await user.type(payload, '{{');
    expect(editor.updateServiceItem).toHaveBeenCalledWith(row.id, 'payloadJson', '{');
  });
});
