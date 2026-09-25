import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  AttributeAdvancedGuestValueFields,
  AttributeAdvancedJsonFields,
  AttributeAdvancedScalarValueFields,
  AttributeAdvancedTextFields,
} from '@/components/features/restaurant-settings/discovery/panels/AttributeAdvancedFieldSections';

import { makeAttributeRow, makeBusinessContextEditor } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { AttributeEditor } from '@/components/features/restaurant-settings/businessContextModel';
import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function setup(rowOver: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor();
  const row = makeAttributeRow(rowOver) as AttributeEditor;
  return { editor: editor as unknown as RestaurantBusinessContextEditor, mocks: editor, row };
}

describe('AttributeAdvancedTextFields', () => {
  it('@contract renders labelled identity fields and routes edits', async () => {
    const user = userEvent.setup();
    const { editor, mocks, row } = setup({ attributeName: '' });
    renderWithDiscoveryForm(<AttributeAdvancedTextFields row={row} editor={editor} />);

    expect(screen.getByLabelText('Key')).toHaveValue('has_wifi');
    await user.type(screen.getByLabelText('Name'), 'a');
    expect(mocks.updateAttribute).toHaveBeenCalledWith(row.id, 'attributeName', 'a');
  });

  it('@a11y shows an issue below the field once staff leave it', async () => {
    const user = userEvent.setup();
    const { editor, row } = setup({ attributeKey: '' });
    const fieldId = `attributes-${row.id}-attributeKey`;
    renderWithDiscoveryForm(<AttributeAdvancedTextFields row={row} editor={editor} />, {
      issues: [
        { family: 'attributes', fieldId, message: 'Enter the attribute key.', disclosures: [] },
      ],
    });

    const key = screen.getByLabelText('Key');
    expect(key).not.toHaveAttribute('aria-invalid');
    await user.click(key);
    await user.tab();

    expect(key).toHaveAttribute('aria-invalid', 'true');
    expect(key).toHaveAccessibleDescription('Enter the attribute key.');
  });
});

describe('AttributeAdvancedScalarValueFields', () => {
  it('@contract changes the yes or no value through the labelled select', async () => {
    const user = userEvent.setup();
    const { editor, mocks, row } = setup();
    renderWithDiscoveryForm(<AttributeAdvancedScalarValueFields row={row} editor={editor} />);

    await user.click(screen.getByRole('combobox', { name: 'Yes or no value' }));
    await user.click(await screen.findByRole('option', { name: 'No' }));

    expect(mocks.updateAttribute).toHaveBeenCalledWith(row.id, 'boolValue', 'false');
  });
});

describe('AttributeAdvancedGuestValueFields', () => {
  it('@contract edits guest-facing text values', async () => {
    const user = userEvent.setup();
    const { editor, mocks, row } = setup({ displayText: '' });
    renderWithDiscoveryForm(<AttributeAdvancedGuestValueFields row={row} editor={editor} />);

    await user.type(screen.getByLabelText('Guest-facing text'), 'W');
    expect(mocks.updateAttribute).toHaveBeenCalledWith(row.id, 'displayText', 'W');
  });
});

describe('AttributeAdvancedJsonFields', () => {
  it('@contract keeps provider payload fields collapsed until requested', async () => {
    const user = userEvent.setup();
    const { editor, row } = setup();
    renderWithDiscoveryForm(<AttributeAdvancedJsonFields row={row} editor={editor} />);

    expect(screen.getByLabelText('Value details (JSON array)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Raw value')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Provider payload fields/ }));
    expect(await screen.findByLabelText('Raw value')).toBeInTheDocument();
    expect(screen.getByLabelText('Display value')).toBeInTheDocument();
  });
});
