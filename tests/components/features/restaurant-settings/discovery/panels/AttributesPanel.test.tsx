import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AttributesPanel } from '@/components/features/restaurant-settings/discovery/panels/AttributesPanel';
import { AMENITY_ATTRIBUTE_GROUPS } from '@/components/features/restaurant-settings/businessContextModel';

import { makeAttributeRow, makeBusinessContextEditor } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

const firstGroup = AMENITY_ATTRIBUTE_GROUPS[0];
const firstDefinition = firstGroup.keys[0];

describe('AttributesPanel', () => {
  it('@smoke renders every amenity group with unchecked options by default', () => {
    const editor = makeBusinessContextEditor();
    render(
      <AttributesPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    for (const group of AMENITY_ATTRIBUTE_GROUPS) {
      expect(screen.getByText(group.title)).toBeInTheDocument();
    }
    expect(screen.getByRole('checkbox', { name: new RegExp(firstDefinition.label) })).not.toBeChecked();
  });

  it('@contract toggles an amenity through the editor', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor();
    render(
      <AttributesPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: new RegExp(firstDefinition.label) }));

    expect(editor.toggleAmenityAttribute).toHaveBeenCalledWith(
      firstDefinition,
      firstGroup.title,
      true,
    );
  });

  it('@contract lists advanced rows behind the collapsible', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor({ attributes: [makeAttributeRow()] });
    render(
      <AttributesPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Advanced attribute rows/ }));

    expect(await screen.findByLabelText('Reference ID')).toHaveValue('has_wifi');
  });

  it('@contract adds an attribute row from the family actions', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor();
    render(
      <AttributesPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Add attribute/ }));

    expect(editor.addAttribute).toHaveBeenCalledTimes(1);
  });
});
