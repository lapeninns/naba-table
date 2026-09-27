import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GbpFieldValue } from '@/components/features/restaurant-settings/dual-sync/GbpFieldValue';

describe('GbpFieldValue', () => {
  it('shows a readable summary and preserves exact data behind a disclosure', async () => {
    const value = {
      displayName: 'Restaurant',
      categoryCode: 'gcid:restaurant',
      isPrimary: true,
      moreHoursTypes: [{ hoursTypeId: 'LUNCH' }],
    };
    const { container } = render(<GbpFieldValue value={value} />);
    expect(screen.getByText('Restaurant · Primary category')).toBeVisible();
    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');
    expect(JSON.parse(container.querySelector('pre')?.textContent ?? '')).toEqual(value);
    await userEvent.click(screen.getByText('View source details'));
    expect(details).toHaveAttribute('open');
    await userEvent.click(screen.getByText('View source details'));
    expect(details).not.toHaveAttribute('open');
  });

  it('does not add technical details to simple values', () => {
    render(<GbpFieldValue value={false} />);
    expect(screen.getByText('No')).toBeVisible();
    expect(screen.queryByText('View source details')).toBeNull();
  });
});
