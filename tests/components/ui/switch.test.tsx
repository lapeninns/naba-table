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

  it('@contract opts out of the global 44px button minimum so it keeps its track size', () => {
    render(<Switch aria-label="Compact" />);

    expect(screen.getByRole('switch', { name: 'Compact' })).toHaveClass(
      'h-5',
      'w-9',
      'min-h-0',
      'min-w-0',
    );
  });

  it('@a11y gains a centred 44px hit area on coarse pointers only', () => {
    render(<Switch aria-label="Touch" />);

    const control = screen.getByRole('switch', { name: 'Touch' });
    expect(control).toHaveClass(
      '[@media(pointer:coarse)]:relative',
      '[@media(pointer:coarse)]:after:absolute',
      '[@media(pointer:coarse)]:after:size-11',
      "[@media(pointer:coarse)]:after:content-['']",
    );
    // Fine pointers keep the unchanged track.
    expect(control).not.toHaveClass('relative');
    expect(control).toHaveClass('h-5', 'w-9');
  });
});
