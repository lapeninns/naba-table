import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from '@/components/ui/skeleton';

describe('ui/skeleton', () => {
  it('@smoke renders a pulsing placeholder div', () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveClass('animate-pulse', 'bg-muted');
  });

  it('@smoke merges sizing classes and forwards props', () => {
    const { container } = render(<Skeleton className="h-4 w-32" data-testid="line" />);

    const skeleton = container.querySelector('[data-testid="line"]');
    expect(skeleton).toHaveClass('h-4', 'w-32', 'rounded-md');
  });
});
