import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncFieldChoiceGroup } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldChoiceGroup';

import type { DualSyncFieldActionAvailability } from '@/components/features/restaurant-settings/dual-sync/dualSyncFieldRowDomain';

const availability: DualSyncFieldActionAvailability = {
  canImport: true,
  canExport: true,
  isUnsupported: false,
};

function renderGroup(overrides: Partial<Parameters<typeof DualSyncFieldChoiceGroup>[0]> = {}) {
  const onChangeAction = vi.fn();
  render(
    <DualSyncFieldChoiceGroup
      fieldKey="profile.name"
      fieldLabel="Business name"
      availability={availability}
      selectedAction={null}
      disabled={false}
      onChangeAction={onChangeAction}
      {...overrides}
    />,
  );
  return { onChangeAction };
}

describe('DualSyncFieldChoiceGroup', () => {
  it('@contract @a11y renders a named native radio group mapped onto the decision actions', async () => {
    const user = userEvent.setup();
    const { onChangeAction } = renderGroup();

    const group = screen.getByRole('group', { name: 'What to do with Business name' });
    expect(group.tagName).toBe('FIELDSET');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'export_to_google',
      'import_from_google',
      'ignore',
    ]);

    await user.click(screen.getByRole('radio', { name: 'Send to Google' }));
    expect(onChangeAction).toHaveBeenLastCalledWith('export_to_google');

    await user.click(screen.getByRole('radio', { name: 'Use Google’s' }));
    expect(onChangeAction).toHaveBeenLastCalledWith('import_from_google');

    await user.click(screen.getByRole('radio', { name: 'Ignore' }));
    expect(onChangeAction).toHaveBeenLastCalledWith('ignore');
  });

  it('@contract reflects the current choice', () => {
    renderGroup({ selectedAction: 'import_from_google' });

    expect(screen.getByRole('radio', { name: 'Use Google’s' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Send to Google' })).not.toBeChecked();
  });

  it('@contract disables unsupported directions and links the blocked reason', () => {
    render(
      <>
        <p id="reasons">Food menus can only be sent to Google.</p>
        <DualSyncFieldChoiceGroup
          fieldKey="foodMenus.menu"
          fieldLabel="Menu"
          availability={{ ...availability, canImport: false }}
          selectedAction={null}
          disabled={false}
          onChangeAction={vi.fn()}
          describedBy="reasons"
        />
      </>,
    );

    expect(screen.getByRole('radio', { name: 'Use Google’s' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Send to Google' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'What to do with Menu' })).toHaveAccessibleDescription(
      'Food menus can only be sent to Google.',
    );
  });

  it('@contract disables every option while writes are blocked', () => {
    renderGroup({ disabled: true });

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });
});
