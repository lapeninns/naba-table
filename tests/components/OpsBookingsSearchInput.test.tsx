import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingsSearchInput } from '@/components/features/bookings/components/OpsBookingsSearchInput';

describe('OpsBookingsSearchInput', () => {
  it('shows clear button when there is text and calls onClear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <OpsBookingsSearchInput
        value="Alice"
        onChange={onChange}
        onClear={onClear}
        isSearching={false}
        size="toolbar"
      />,
    );

    const clear = screen.getByRole('button', { name: /clear search/i });
    await user.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows spinner when searching and hides clear button', () => {
    render(
      <OpsBookingsSearchInput
        value="Alice"
        onChange={() => {}}
        isSearching={true}
        size="header"
      />,
    );

    expect(screen.getByLabelText(/searching/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });
});

