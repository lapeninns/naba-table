import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatingHoursOverrideDateField } from '@/components/features/restaurant-settings/OperatingHoursOverrideDateField';

describe('OperatingHoursOverrideDateField', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 11, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@smoke renders a Date picker field with the formatted value', () => {
    render(<OperatingHoursOverrideDateField value="2026-12-24" onChange={vi.fn()} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Date/i })).toHaveTextContent(/Dec 24, 2026/);
  });

  it('@smoke surfaces error text and disabled state through the underlying field', () => {
    render(
      <OperatingHoursOverrideDateField
        value=""
        onChange={vi.fn()}
        disabled
        error="Date is required"
      />,
    );

    expect(screen.getByRole('button', { name: /Date/i })).toBeDisabled();
    expect(screen.getByText('Date is required')).toBeInTheDocument();
  });
});
