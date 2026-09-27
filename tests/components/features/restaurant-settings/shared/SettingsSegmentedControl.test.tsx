import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsSegmentedControl } from '@/components/features/restaurant-settings/shared/SettingsSegmentedControl';

type Filter = 'waiting' | 'expired' | 'all';

const OPTIONS = [
  { value: 'waiting', label: 'Waiting', count: 0 },
  { value: 'expired', label: 'Expired', count: 1 },
  { value: 'all', label: 'All', count: 1 },
] as const;

function Harness({ onChange }: { onChange: (value: Filter) => void }) {
  const [value, setValue] = useState<Filter>('waiting');
  return (
    <>
      <button type="button">Before</button>
      <SettingsSegmentedControl<Filter>
        value={value}
        options={OPTIONS}
        ariaLabel="Invitation status"
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </>
  );
}

describe('SettingsSegmentedControl', () => {
  it('@contract renders a labelled group with the selected segment pressed and counts', () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Invitation status' })).toBeInTheDocument();
    const waiting = screen.getByRole('radio', { name: 'Waiting 0' });
    expect(waiting).toHaveAttribute('data-state', 'on');
    expect(waiting).toHaveClass('data-[state=on]:bg-background', 'h-8', 'min-h-0');
    expect(waiting).not.toHaveClass('data-[state=on]:bg-primary');
    const count = waiting.querySelector('[data-slot="segment-count"]');
    expect(count).toHaveTextContent('0');
    expect(count).toHaveClass('tabular-nums');
  });

  it('@a11y is one tab stop and moves with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Waiting 0' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Expired 1' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('expired');
    expect(screen.getByRole('radio', { name: 'Expired 1' })).toHaveAttribute('data-state', 'on');

    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('@contract never deselects to an empty value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Waiting 0' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Waiting 0' })).toHaveAttribute('data-state', 'on');
  });

  it('@contract wraps inside the track instead of clipping or scrolling segments away', () => {
    render(<Harness onChange={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Invitation status' });
    expect(group).toHaveClass('flex-wrap', 'max-w-full', 'min-w-0', 'bg-muted');
    expect(group).not.toHaveClass('overflow-x-auto');
    expect(group).not.toHaveClass('flex-nowrap');
  });

  it('@a11y is at least 44x44 on coarse pointers while fine pointers keep 32px', () => {
    render(<Harness onChange={vi.fn()} />);

    const segment = screen.getByRole('radio', { name: 'Expired 1' });
    expect(segment).toHaveClass(
      'h-8',
      '[@media(pointer:coarse)]:h-11',
      '[@media(pointer:coarse)]:min-w-11',
    );
  });
});
