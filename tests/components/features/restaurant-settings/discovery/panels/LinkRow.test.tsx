import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LinkRow } from '@/components/features/restaurant-settings/discovery/panels/LinkRow';

import { makeBusinessContextEditor, makeLinkRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { LinkEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderRow(rowOver: Record<string, unknown> = {}, showAllIssues = false) {
  const editor = makeBusinessContextEditor();
  const onRemove = vi.fn();
  const row = makeLinkRow(rowOver) as LinkEditor;
  renderWithDiscoveryForm(
    <LinkRow
      row={row}
      editor={editor as unknown as RestaurantBusinessContextEditor}
      onRemove={onRemove}
    />,
    {
      showAllIssues,
      issues: [
        {
          family: 'links',
          fieldId: `links-${row.id}-url`,
          message: 'Enter a full web address, starting with https://',
          disclosures: [],
        },
      ],
    },
  );
  return { editor, row, onRemove };
}

describe('LinkRow', () => {
  it('@smoke shows type, web address, label and the Main switch', () => {
    renderRow();

    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Website');
    expect(screen.getByLabelText('Web address')).toHaveValue('https://example.com');
    expect(screen.getByLabelText('Label')).toHaveValue('Website');
    expect(screen.getByRole('switch', { name: 'Main' })).not.toBeChecked();
  });

  it('@contract routes edits and removal', async () => {
    const user = userEvent.setup();
    const { editor, row, onRemove } = renderRow({ label: '' });

    await user.type(screen.getByLabelText('Label'), 'W');
    expect(editor.updateLink).toHaveBeenCalledWith(row.id, 'label', 'W');
    await user.click(screen.getByRole('switch', { name: 'Main' }));
    expect(editor.updateLink).toHaveBeenCalledWith(row.id, 'isPrimary', true);
    await user.click(screen.getByRole('button', { name: 'Remove Website link' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('@a11y shows the address issue after a save attempt', () => {
    renderRow({ url: 'example.com' }, true);

    const address = screen.getByLabelText('Web address');
    expect(address).toHaveAttribute('aria-invalid', 'true');
    expect(address).toHaveAccessibleDescription('Enter a full web address, starting with https://');
  });
});
