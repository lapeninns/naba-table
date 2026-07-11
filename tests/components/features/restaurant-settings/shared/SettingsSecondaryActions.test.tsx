import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SettingsSecondaryActions } from '@/components/features/restaurant-settings/shared/SettingsSecondaryActions';

describe('SettingsSecondaryActions', () => {
  it('@contract keeps secondary actions collapsed until toggled', async () => {
    const user = userEvent.setup();
    render(
      <SettingsSecondaryActions label="More actions">
        <button type="button">Export data</button>
      </SettingsSecondaryActions>,
    );

    expect(screen.queryByRole('button', { name: 'Export data' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /More actions/ }));

    expect(await screen.findByRole('button', { name: 'Export data' })).toBeInTheDocument();
  });
});
