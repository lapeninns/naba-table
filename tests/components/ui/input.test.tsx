import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '@/components/ui/input';

describe('ui/input', () => {
  it('@smoke renders a textbox that accepts typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('data-slot', 'input');
    await user.type(input, 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('@smoke forwards type and merges custom classes', () => {
    render(<Input aria-label="Amount" type="number" className="w-20" />);

    const input = screen.getByRole('spinbutton', { name: 'Amount' });
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveClass('w-20', 'rounded-md');
  });

  it('@smoke respects the disabled state', () => {
    render(<Input aria-label="Locked" disabled />);

    expect(screen.getByRole('textbox', { name: 'Locked' })).toBeDisabled();
  });
});
