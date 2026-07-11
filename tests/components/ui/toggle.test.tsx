import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Toggle } from '@/components/ui/toggle';

describe('ui/toggle', () => {
  it('@smoke @a11y toggles pressed state on click', async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(<Toggle aria-label="Bold" onPressedChange={onPressedChange} />);

    const toggle = screen.getByRole('button', { name: 'Bold' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(onPressedChange).toHaveBeenCalledWith(true);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('data-state', 'on');
  });

  it('@contract applies cva variant and size classes', () => {
    const { rerender } = render(<Toggle aria-label="Styled" variant="outline" size="sm" />);
    const toggle = screen.getByRole('button', { name: 'Styled' });
    expect(toggle).toHaveClass('border', 'border-input', 'h-8');

    rerender(<Toggle aria-label="Styled" size="lg" />);
    expect(screen.getByRole('button', { name: 'Styled' })).toHaveClass('h-10', 'bg-transparent');
  });

  it('@smoke defaults to the transparent default variant', () => {
    render(<Toggle aria-label="Plain" />);

    const toggle = screen.getByRole('button', { name: 'Plain' });
    expect(toggle).toHaveClass('bg-transparent', 'h-9');
    expect(toggle).not.toHaveClass('border-input');
  });

  it('@smoke disabled toggles do not fire', async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(<Toggle aria-label="Locked" disabled onPressedChange={onPressedChange} />);

    await user.click(screen.getByRole('button', { name: 'Locked' }));
    expect(onPressedChange).not.toHaveBeenCalled();
  });
});
