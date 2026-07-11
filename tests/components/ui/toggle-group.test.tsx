import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

describe('ui/toggle-group', () => {
  it('@contract single-type group selects one value at a time', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ToggleGroup type="single" value="left" onValueChange={onValueChange}>
        <ToggleGroupItem value="left" aria-label="Align left" />
        <ToggleGroupItem value="right" aria-label="Align right" />
      </ToggleGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Align left' })).toHaveAttribute(
      'data-state',
      'on',
    );

    await user.click(screen.getByRole('radio', { name: 'Align right' }));
    expect(onValueChange).toHaveBeenCalledWith('right');
  });

  it('@contract group-level variant and size cascade to items via context', () => {
    render(
      <ToggleGroup type="multiple" variant="outline" size="sm">
        <ToggleGroupItem value="one" aria-label="One" />
      </ToggleGroup>,
    );

    expect(screen.getByRole('button', { name: 'One' })).toHaveClass('border-input', 'h-8');
  });

  it('@contract item-level variant applies when the group sets none', () => {
    render(
      <ToggleGroup type="multiple">
        <ToggleGroupItem value="one" variant="outline" aria-label="Solo" />
      </ToggleGroup>,
    );

    expect(screen.getByRole('button', { name: 'Solo' })).toHaveClass('border-input');
  });
});
