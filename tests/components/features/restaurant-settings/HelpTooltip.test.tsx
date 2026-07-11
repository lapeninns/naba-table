import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';

// HelpTooltip relies on the app-level Radix TooltipProvider (mounted in the ops layout).
function renderHelpTooltip() {
  return render(
    <TooltipProvider>
      <HelpTooltip description="Explains the setting." ariaLabel="About turn times" />
    </TooltipProvider>,
  );
}

describe('HelpTooltip', () => {
  it('@smoke @a11y exposes the trigger button with its accessible label', () => {
    renderHelpTooltip();

    expect(screen.getByRole('button', { name: 'About turn times' })).toBeInTheDocument();
  });

  it('@contract shows the description as tooltip content on hover', async () => {
    const user = userEvent.setup();
    renderHelpTooltip();

    await user.hover(screen.getByRole('button', { name: 'About turn times' }));

    await waitFor(() => {
      expect(screen.getAllByText('Explains the setting.').length).toBeGreaterThan(0);
    });
  });
});
