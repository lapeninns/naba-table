import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  OpsEmailDeliveryFilterBar,
  TEMPLATE_TYPE_OPTIONS,
  EMAIL_TYPE_OPTIONS,
} from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';

import type { OpsEmailDeliveryFilterBarProps } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';

function renderFilterBar(overrides: Partial<OpsEmailDeliveryFilterBarProps> = {}) {
  const defaultProps: OpsEmailDeliveryFilterBarProps = {
    searchField: 'recipientEmail',
    searchValue: '',
    onSearchFieldChange: vi.fn(),
    onSearchValueChange: vi.fn(),
    onSubmitSearch: vi.fn(),
    range: '7d',
    onRangeChange: vi.fn(),
    templateType: null,
    onTemplateTypeChange: vi.fn(),
    emailType: null,
    onEmailTypeChange: vi.fn(),
    statuses: [],
    statusCounts: null,
    onToggleStatus: vi.fn(),
    onClear: vi.fn(),
  };

  const props = { ...defaultProps, ...overrides };
  return { ...render(<OpsEmailDeliveryFilterBar {...props} />), props };
}

describe('OpsEmailDeliveryFilterBar', () => {
  it('renders search field dropdown, input, and search button', () => {
    renderFilterBar();

    // Search input
    expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument();

    // Search button
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('renders time range toggle with 24h, 7d, 30d options', () => {
    renderFilterBar({ range: '7d' });

    expect(screen.getByRole('radio', { name: /24.*hours/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /7.*days/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /30.*days/i })).toBeInTheDocument();
  });

  it('calls onRangeChange when a range option is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderFilterBar({ range: '7d' });

    await user.click(screen.getByRole('radio', { name: /24.*hours/i }));
    expect(props.onRangeChange).toHaveBeenCalledWith('24h');
  });

  it('renders clear button and calls onClear when clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderFilterBar();

    const clearButton = screen.getByRole('button', { name: /clear/i });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmitSearch on Enter key in search input', async () => {
    const user = userEvent.setup();
    const { props } = renderFilterBar({ searchValue: 'test@example.com' });

    const searchInput = screen.getByRole('searchbox', { name: /search/i });
    await user.click(searchInput);
    await user.keyboard('{Enter}');

    expect(props.onSubmitSearch).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmitSearch when Search button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderFilterBar({ searchValue: 'test@example.com' });

    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(props.onSubmitSearch).toHaveBeenCalledTimes(1);
  });

  it('calls onSearchValueChange when typing in search input', async () => {
    const user = userEvent.setup();
    const { props } = renderFilterBar();

    const searchInput = screen.getByRole('searchbox', { name: /search/i });
    await user.type(searchInput, 'a');

    expect(props.onSearchValueChange).toHaveBeenCalled();
  });

  it('exports TEMPLATE_TYPE_OPTIONS with expected values', () => {
    expect(TEMPLATE_TYPE_OPTIONS).toEqual([
      'booking_confirmation',
      'booking_update',
      'booking_cancellation',
      'review_request',
      'reminder_24h',
      'reminder_short',
    ]);
  });

  it('exports EMAIL_TYPE_OPTIONS with expected values', () => {
    expect(EMAIL_TYPE_OPTIONS).toEqual([
      'created',
      'updated',
      'cancelled',
      'review_request',
      'reminder',
    ]);
  });

  it('renders status filter button with badge count when statuses are selected', () => {
    renderFilterBar({ statuses: ['failed', 'bounced'] });

    const statusButton = screen.getByRole('button', { name: /status/i });
    expect(statusButton).toBeInTheDocument();
    // Should show badge with count of selected statuses
    expect(within(statusButton).getByText('2')).toBeInTheDocument();
  });
});
