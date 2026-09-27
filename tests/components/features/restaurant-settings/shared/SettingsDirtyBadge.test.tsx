import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsDirtyBadge } from '@/components/features/restaurant-settings/shared/SettingsDirtyBadge';

describe('SettingsDirtyBadge', () => {
  it('@contract is labelled "Edited" by default as a pending status pill', () => {
    render(<SettingsDirtyBadge />);

    expect(screen.getByText('Edited')).toHaveClass('rounded-full', 'bg-warning/10');
  });

  it('@contract accepts a custom label', () => {
    render(<SettingsDirtyBadge label="Unsaved" />);

    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });
});
