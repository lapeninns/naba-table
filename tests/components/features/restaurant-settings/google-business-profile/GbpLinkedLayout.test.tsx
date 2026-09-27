import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GbpLinkedLayout } from '@/components/features/restaurant-settings/google-business-profile/components/GbpLinkedLayout';
import {
  SETTINGS_TABS_LIST_CLASS,
  SETTINGS_TABS_TRIGGER_CLASS,
} from '@/components/features/restaurant-settings/shared/compactSettingsClasses';

function renderLayout(operationsNeedAttention = false) {
  render(
    <GbpLinkedLayout
      overview={<p>Overview</p>}
      alerts={null}
      differenceCount={3}
      review={<p>Review body</p>}
      operations={<p>Operations body</p>}
      operationsNeedAttention={operationsNeedAttention}
    />,
  );
}

describe('GbpLinkedLayout', () => {
  it('@contract uses the shared underline tab rail for Review and Operations', async () => {
    const user = userEvent.setup();
    renderLayout(true);

    const list = screen.getByRole('tablist', { name: 'Google Business Profile' });
    // Wrapped so tabs that don't fit on a narrow phone get an edge fade (RR2).
    expect(list.parentElement).toHaveAttribute('data-slot', 'settings-overflow-frame');
    for (const token of SETTINGS_TABS_LIST_CLASS.split(' ')) {
      expect(list).toHaveClass(token);
    }
    const review = screen.getByRole('tab', { name: /Review differences/ });
    const operations = screen.getByRole('tab', { name: /Operations/ });
    for (const tab of [review, operations]) {
      expect(tab).toHaveClass('h-11', 'border-b-2', 'shrink-0');
      expect(tab.className).not.toContain('after:');
      expect(tab.className).not.toContain('min-h-[42px]');
    }
    expect(SETTINGS_TABS_TRIGGER_CLASS).toContain('data-[state=active]:border-primary');
    expect(review).toHaveTextContent('3');

    // A status badge, not a solid destructive fill.
    expect(screen.getByText('Needs attention')).toHaveClass('bg-destructive/10');

    await user.click(operations);
    expect(screen.getByText('Operations body')).toBeVisible();
  });
});
