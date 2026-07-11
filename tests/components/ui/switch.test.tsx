import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '@/components/ui/switch';

describe('ui/switch', () => {
  it('@smoke @a11y renders a switch role and reports toggles', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Notifications" onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole('switch', { name: 'Notifications' });
    expect(control).not.toBeChecked();

    await user.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(control).toBeChecked();
  });

  it('@smoke reflects the controlled checked state via data attributes', () => {
    render(<Switch aria-label="On" checked />);

    const control = screen.getByRole('switch', { name: 'On' });
    expect(control).toBeChecked();
    expect(control).toHaveAttribute('data-state', 'checked');
  });

  it('@smoke ignores clicks while disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Locked" disabled onCheckedChange={onCheckedChange} />);

    expect(screen.getByRole('switch', { name: 'Locked' })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Locked' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
