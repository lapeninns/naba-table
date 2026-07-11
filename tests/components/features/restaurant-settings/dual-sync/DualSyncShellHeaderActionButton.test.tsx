import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RefreshCw } from 'lucide-react';

import { DualSyncShellHeaderActionButton } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellHeaderActionButton';
import { TooltipProvider } from '@/components/ui/tooltip';

import type { DualSyncShellHeaderActionButtonModel } from '@/components/features/restaurant-settings/dual-sync/dualSyncShellHeaderActionButtonDomain';

function makeAction(
  over: Partial<DualSyncShellHeaderActionButtonModel> = {},
): DualSyncShellHeaderActionButtonModel {
  return {
    id: 'refresh',
    label: 'Refresh',
    icon: 'refresh',
    variant: 'outline',
    disabled: false,
    ariaDisabled: undefined,
    className: undefined,
    iconMotion: 'none',
    tooltip: null,
    ...over,
  } as DualSyncShellHeaderActionButtonModel;
}

describe('DualSyncShellHeaderActionButton', () => {
  it('@contract fires onClick for an enabled plain button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DualSyncShellHeaderActionButton action={makeAction()} icon={RefreshCw} onClick={onClick} />,
    );

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('@contract disables the button and spins the icon while pending', () => {
    render(
      <DualSyncShellHeaderActionButton
        action={makeAction({ disabled: true, iconMotion: 'spin' })}
        icon={RefreshCw}
        onClick={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Refresh' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('@contract wraps the button in a tooltip when hints are provided', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <DualSyncShellHeaderActionButton
          action={makeAction({
            tooltip: { enabledHint: 'Re-check Google now.', disabledHint: 'Busy.' },
          })}
          icon={RefreshCw}
          onClick={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole('button', { name: 'Refresh' }));

    expect((await screen.findAllByText('Re-check Google now.')).length).toBeGreaterThan(0);
  });
});
