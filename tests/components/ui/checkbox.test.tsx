import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from '@/components/ui/checkbox';

describe('ui/checkbox', () => {
  it('@smoke @a11y renders an uncheckable checkbox role and toggles on click', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Accept" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Accept' });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(checkbox).toBeChecked();
  });

  it('@smoke reflects a controlled checked state', () => {
    render(<Checkbox aria-label="Fixed" checked />);

    expect(screen.getByRole('checkbox', { name: 'Fixed' })).toBeChecked();
  });

  it('@smoke ignores clicks while disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Locked" disabled onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Locked' });
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
