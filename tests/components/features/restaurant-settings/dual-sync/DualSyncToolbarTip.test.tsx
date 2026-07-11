import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DualSyncToolbarTip } from '@/components/features/restaurant-settings/dual-sync/DualSyncToolbarTip';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderTip(disabled: boolean) {
  render(
    <TooltipProvider>
      <DualSyncToolbarTip
        enabledHint="Publish the selected fields."
        disabledHint="Select at least one field first."
        disabled={disabled}
      >
        <button type="button" disabled={disabled}>
          Publish
        </button>
      </DualSyncToolbarTip>
    </TooltipProvider>,
  );
}

describe('DualSyncToolbarTip', () => {
  it('@contract shows the enabled hint when the control is usable', async () => {
    const user = userEvent.setup();
    renderTip(false);

    await user.hover(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(screen.getAllByText('Publish the selected fields.').length).toBeGreaterThan(0);
    });
  });

  it('@contract keeps the disabled hint reachable when the control is disabled', async () => {
    const user = userEvent.setup();
    renderTip(true);

    await user.hover(screen.getByText('Publish').parentElement as HTMLElement);

    await waitFor(() => {
      expect(screen.getAllByText('Select at least one field first.').length).toBeGreaterThan(0);
    });
  });
});
