import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from '@/components/ui/label';

describe('ui/label', () => {
  it('@smoke @a11y associates with a control via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email-input">Email</Label>
        <input id="email-input" />
      </>,
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('@smoke merges custom classes onto the label element', () => {
    render(<Label className="text-lg">Big label</Label>);

    const label = screen.getByText('Big label');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveClass('text-lg', 'font-medium');
    expect(label).toHaveAttribute('data-slot', 'label');
  });
});
