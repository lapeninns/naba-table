import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsStatusFacts } from '@/components/features/restaurant-settings/shared/SettingsStatusFacts';

describe('SettingsStatusFacts', () => {
  it('@contract renders a status badge and muted facts in the status row', () => {
    const { container } = render(
      <SettingsStatusFacts badge={{ label: '2 menus live', variant: 'status-confirmed' }}>
        <span>14 items</span>
      </SettingsStatusFacts>,
    );

    const row = container.querySelector('[data-slot="settings-status-facts"]');
    expect(row).toHaveClass('flex-wrap', 'gap-x-3', 'gap-y-1', 'text-xs', 'text-muted-foreground');
    expect(screen.getByText('2 menus live')).toHaveClass('rounded-full', 'bg-success/10');
    expect(screen.getByText('14 items')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('@a11y is a polite live status only when asked', () => {
    render(
      <SettingsStatusFacts live>
        <span>3 tables off</span>
      </SettingsStatusFacts>,
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
