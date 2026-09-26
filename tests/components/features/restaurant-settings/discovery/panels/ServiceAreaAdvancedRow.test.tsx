import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceAreaAdvancedRow } from '@/components/features/restaurant-settings/discovery/panels/ServiceAreaAdvancedRow';

import { makeBusinessContextEditor, makeServiceAreaRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { ServiceAreaEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeServiceAreaRow(rowOver) as ServiceAreaEditor;
  renderWithDiscoveryForm(
    <ServiceAreaAdvancedRow
      row={row}
      editor={editor as unknown as RestaurantBusinessContextEditor}
    />,
  );
  return { editor, row };
}

describe('ServiceAreaAdvancedRow', () => {
  it('@smoke renders the area with its current structured fields', () => {
    renderRow();

    expect(screen.getByRole('group', { name: /Cambridge/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Area name')).toHaveValue('Cambridge');
    expect(screen.getByLabelText('Area type')).toHaveValue('locality');
    expect(screen.getByLabelText('Country or region')).toHaveValue('GB');
  });

  it('@contract edits a structured field and keeps Google place fields collapsed', async () => {
    const user = userEvent.setup();
    const { editor, row } = renderRow({ regionCode: '' });

    await user.type(screen.getByLabelText('Country or region'), 'G');
    expect(editor.updateServiceArea).toHaveBeenCalledWith(row.id, 'regionCode', 'G');

    expect(screen.queryByLabelText('Google place ID')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Google place fields/ }));
    expect(screen.getByLabelText('Google place ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Place data (JSON object)')).toBeInTheDocument();
  });
});
