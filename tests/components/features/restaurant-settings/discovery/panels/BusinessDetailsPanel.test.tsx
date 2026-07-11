import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessDetailsPanel } from '@/components/features/restaurant-settings/discovery/panels/BusinessDetailsPanel';

import { makeBusinessContextEditor } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

describe('BusinessDetailsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 11, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@smoke composes status line, details form, and family actions', () => {
    const editor = makeBusinessContextEditor();
    render(
      <BusinessDetailsPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Business status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile basics' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset draft/ })).toBeDisabled();
  });

  it('@contract surfaces the family error alert', () => {
    const editor = makeBusinessContextEditor({
      errors: { businessDetails: 'Could not save profile basics' },
    });
    render(
      <BusinessDetailsPanel
        embedded={false}
        editor={editor as unknown as RestaurantBusinessContextEditor}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save profile basics');
  });
});
