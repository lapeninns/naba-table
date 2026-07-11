import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from '@/components/ui/progress';

describe('ui/progress', () => {
  it('@smoke @a11y renders a progressbar with the given value', () => {
    render(<Progress value={40} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('@contract clamps values above the max and below zero', () => {
    const { rerender } = render(<Progress value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    rerender(<Progress value={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('@contract supports a custom max and defaults missing values to zero', () => {
    const { rerender } = render(<Progress value={5} max={10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '10');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');

    rerender(<Progress />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('@smoke merges custom classes on the track', () => {
    render(<Progress value={10} className="h-1" />);

    expect(screen.getByRole('progressbar')).toHaveClass('h-1', 'rounded-full');
  });
});
