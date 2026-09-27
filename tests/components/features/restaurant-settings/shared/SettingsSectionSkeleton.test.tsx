import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsSectionSkeleton } from '@/components/features/restaurant-settings/shared/SettingsSectionSkeleton';

describe('SettingsSectionSkeleton', () => {
  it('@a11y announces a busy status with a screen-reader-only label', () => {
    render(<SettingsSectionSkeleton label="Loading team" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('data-variant', 'section');
    expect(screen.getByText('Loading team')).toHaveClass('sr-only');
  });

  it('@contract renders a full-height split for workspaces', () => {
    render(<SettingsSectionSkeleton label="Loading floor layout" variant="workspace" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-variant', 'workspace');
    expect(status).toHaveClass('flex-1', 'min-h-0');
  });
});
