import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AMENITY_ATTRIBUTE_GROUPS } from '@/components/features/restaurant-settings/businessContextModel';
import { AttributesPanel } from '@/components/features/restaurant-settings/discovery/panels/AttributesPanel';

import { makeAttributeRow, makeBusinessContextEditor } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

const wifiGroup = AMENITY_ATTRIBUTE_GROUPS.find((group) =>
  group.keys.some((definition) => definition.key === 'has_wifi'),
)!;
const wifi = wifiGroup.keys.find((definition) => definition.key === 'has_wifi')!;

function renderPanel(over: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor(over);
  renderWithDiscoveryForm(
    <AttributesPanel editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return editor;
}

describe('AttributesPanel', () => {
  it('@smoke lists every catalogue group, collapsed, with how many are set', () => {
    renderPanel({ attributes: [makeAttributeRow({ boolValue: 'false' })] });

    for (const group of AMENITY_ATTRIBUTE_GROUPS) {
      const trigger = screen.getByRole('button', { name: new RegExp(group.title) });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
    // "No" counts as set: it is an answer.
    expect(
      screen.getByRole('button', {
        name: new RegExp(`${wifiGroup.title}.*1 of ${wifiGroup.keys.length} set`),
      }),
    ).toBeInTheDocument();
  });

  it('@a11y shows each amenity as a native Yes / No / Not set radio group', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: new RegExp(wifiGroup.title) }));
    const group = screen.getByRole('radiogroup', { name: wifi.label });
    const radios = within(group).getAllByRole('radio');

    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Yes',
      'No',
      'Not set',
    ]);
    expect(within(group).getByRole('radio', { name: 'Not set' })).toBeChecked();
  });

  it('@contract sends Yes, No and Not set to the editor', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({ attributes: [makeAttributeRow({ boolValue: 'true' })] });

    await user.click(screen.getByRole('button', { name: new RegExp(wifiGroup.title) }));
    const group = screen.getByRole('radiogroup', { name: wifi.label });
    expect(within(group).getByRole('radio', { name: 'Yes' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'No' }));
    expect(editor.setAmenityValue).toHaveBeenLastCalledWith(wifi, wifiGroup.title, 'false');
    await user.click(within(group).getByRole('radio', { name: 'Not set' }));
    expect(editor.setAmenityValue).toHaveBeenLastCalledWith(wifi, wifiGroup.title, 'unset');
  });

  it('@contract keeps raw attribute data behind an advanced disclosure', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({ attributes: [makeAttributeRow()] });

    expect(screen.queryByLabelText('Reference ID')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Raw attribute data/ }));
    expect(await screen.findByLabelText('Reference ID')).toHaveValue('has_wifi');

    await user.click(screen.getByRole('button', { name: /Add attribute/ }));
    expect(editor.addAttribute).toHaveBeenCalledTimes(1);
  });
});
