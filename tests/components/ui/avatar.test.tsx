import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

describe('ui/avatar', () => {
  it('@smoke shows the fallback while the image has not loaded (jsdom never loads)', () => {
    render(
      <Avatar>
        <AvatarImage src="/nope.png" alt="Amrit" />
        <AvatarFallback>AM</AvatarFallback>
      </Avatar>,
    );

    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.getByText('AM')).toHaveAttribute('data-slot', 'avatar-fallback');
  });

  it('@smoke merges classes on the root and keeps it rounded', () => {
    const { container } = render(
      <Avatar className="size-12">
        <AvatarFallback>XY</AvatarFallback>
      </Avatar>,
    );

    const root = container.querySelector('[data-slot="avatar"]');
    expect(root).toHaveClass('size-12', 'rounded-full');
  });
});
