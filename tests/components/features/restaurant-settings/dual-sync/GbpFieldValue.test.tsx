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
    const { container } = render(<GbpFieldValue value={value} context="Google · Category" />);
    expect(screen.getByText('Restaurant · Primary category')).toBeVisible();
    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');
    expect(container.querySelector('summary')).toHaveAccessibleName(
      'View source details: Google · Category',
    );
    expect(JSON.parse(container.querySelector('pre')?.textContent ?? '')).toEqual(value);
    await userEvent.click(screen.getByText('View source details'));
    expect(details).toHaveAttribute('open');
    await userEvent.click(screen.getByText('View source details'));
    expect(details).not.toHaveAttribute('open');
  });

  it('does not add technical details to simple values', () => {
    render(<GbpFieldValue value={false} context="Google · Live music" />);
    expect(screen.getByText('No')).toBeVisible();
    expect(screen.queryByText('View source details')).toBeNull();
  });

  it('distinguishes an empty string from a missing value in publish previews', () => {
    render(
      <>
        <GbpFieldValue value="" context="Before Google" />
        <GbpFieldValue value={null} context="After Google" />
      </>,
    );
    expect(screen.getByText('Empty text')).toBeVisible();
    expect(screen.getByText('—')).toBeVisible();
  });

  it('preserves description whitespace and exposes exact string details', () => {
    const value = '  First line\nSecond  line  ';
    const { container } = render(
      <GbpFieldValue value={value} context="After Google · Description" />,
    );
    const summary = container.querySelector('span');
    expect(summary?.textContent).toBe(value);
    expect(summary).toHaveClass('whitespace-pre-wrap');
    expect(JSON.parse(container.querySelector('pre')?.textContent ?? '')).toBe(value);
  });
});
