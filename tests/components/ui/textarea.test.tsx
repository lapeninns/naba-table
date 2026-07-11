import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Textarea } from '@/components/ui/textarea';

describe('ui/textarea', () => {
  it('@smoke renders a multiline textbox that accepts typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea aria-label="Notes" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea.tagName).toBe('TEXTAREA');
    await user.type(textarea, 'x');
    expect(onChange).toHaveBeenCalled();
  });

  it('@smoke merges custom classes and honors disabled', () => {
    render(<Textarea aria-label="Locked" className="h-40" disabled />);

    const textarea = screen.getByRole('textbox', { name: 'Locked' });
    expect(textarea).toHaveClass('h-40', 'rounded-md');
    expect(textarea).toBeDisabled();
  });
});
