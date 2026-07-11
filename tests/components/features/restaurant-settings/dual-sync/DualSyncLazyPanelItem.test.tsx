import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Accordion } from '@/components/ui/accordion';
import { DualSyncLazyPanelItem } from '@/components/features/restaurant-settings/dual-sync/DualSyncLazyPanelItem';

import type { DualSyncLazyPanelState } from '@/components/features/restaurant-settings/dual-sync/dualSyncLazyPanelsDomain';

function makePanel(over: Partial<DualSyncLazyPanelState> = {}): DualSyncLazyPanelState {
  return {
    id: 'metrics',
    value: 'metrics',
    title: 'Operational health',
    isActive: false,
    inactiveDescription: 'Metrics load when you open this panel.',
    loadButtonLabel: 'Load metrics',
    ...over,
  } as DualSyncLazyPanelState;
}

function renderItem(panel: DualSyncLazyPanelState) {
  const onActivate = vi.fn();
  render(
    <Accordion type="multiple" defaultValue={[panel.value]}>
      <DualSyncLazyPanelItem panel={panel} onActivate={onActivate}>
        <p>Loaded metrics content</p>
      </DualSyncLazyPanelItem>
    </Accordion>,
  );
  return onActivate;
}

describe('DualSyncLazyPanelItem', () => {
  it('@contract shows the load placeholder until the panel activates', () => {
    renderItem(makePanel());

    expect(screen.getByText('Metrics load when you open this panel.')).toBeInTheDocument();
    expect(screen.queryByText('Loaded metrics content')).not.toBeInTheDocument();
  });

  it('@contract activates via the explicit load button', async () => {
    const user = userEvent.setup();
    const onActivate = renderItem(makePanel());

    await user.click(screen.getByRole('button', { name: /Load metrics/ }));

    expect(onActivate).toHaveBeenCalled();
  });

  it('@contract renders the children once active', () => {
    renderItem(makePanel({ isActive: true }));

    expect(screen.getByText('Loaded metrics content')).toBeInTheDocument();
  });
});
