import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryAnalyticsHeader } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsHeader';

import type { OpsEmailDeliveryAnalyticsHeaderProps } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsHeader';

function renderHeader(overrides: Partial<OpsEmailDeliveryAnalyticsHeaderProps> = {}) {
  const props: OpsEmailDeliveryAnalyticsHeaderProps = {
    isLoading: false,
    isUpdating: false,
    lastUpdatedAt: null,
    onRangeChange: vi.fn(),
    range: '7d',
    ...overrides,
  };
  return { ...render(<OpsEmailDeliveryAnalyticsHeader {...props} />), props };
}

describe('OpsEmailDeliveryAnalyticsHeader', () => {
  it('@contract @a11y renders the analytics range toggle with the current range selected', () => {
    renderHeader({ range: '7d' });

    expect(screen.getByText('Delivery analytics')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Analytics range 7d' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Analytics range 24h' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('radio', { name: 'Analytics range 30d' })).toBeInTheDocument();
  });

  it('@contract reports valid range selections through onRangeChange', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ range: '7d' });

    await user.click(screen.getByRole('radio', { name: 'Analytics range 30d' }));

    expect(props.onRangeChange).toHaveBeenCalledWith('30d');
  });

  it('@contract ignores toggle deselection (empty value) instead of emitting an invalid range', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ range: '7d' });

    // Clicking the already-active option makes Radix emit '' — the guard drops it.
    await user.click(screen.getByRole('radio', { name: 'Analytics range 7d' }));

    expect(props.onRangeChange).not.toHaveBeenCalled();
  });

  it('@contract shows the last-updated badge from the provided timestamp, independent of host timezone', () => {
    const lastUpdatedAt = Date.parse('2026-03-20T15:04:00Z');
    renderHeader({ lastUpdatedAt });

    // Mirror the component's own locale/host-TZ formatting so the assertion
    // holds under any TZ the suite runs in.
    const expected = new Date(lastUpdatedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    expect(screen.getByText(`Updated ${expected}`)).toBeInTheDocument();
  });

  it('@contract shows the Updating badge only while a background update is running (not during initial load)', () => {
    const { rerender } = renderHeader({ isUpdating: true, isLoading: false });
    expect(screen.getByText('Updating…')).toBeInTheDocument();

    rerender(
      <OpsEmailDeliveryAnalyticsHeader
        isLoading
        isUpdating
        lastUpdatedAt={null}
        onRangeChange={vi.fn()}
        range="7d"
      />,
    );
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument();
  });
});
