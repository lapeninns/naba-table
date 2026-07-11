import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Separator } from '@/components/ui/separator';

describe('ui/separator', () => {
  it('@smoke renders a decorative horizontal rule by default', () => {
    const { container } = render(<Separator />);

    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).not.toBeNull();
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    // decorative separators are hidden from the accessibility tree
    expect(separator).toHaveAttribute('role', 'none');
  });

  it('@smoke @a11y supports a semantic vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" decorative={false} />);

    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).toHaveAttribute('data-orientation', 'vertical');
    expect(separator).toHaveAttribute('role', 'separator');
  });

  it('@smoke merges custom classes', () => {
    const { container } = render(<Separator className="my-8" />);

    expect(container.querySelector('[data-slot="separator"]')).toHaveClass('my-8', 'shrink-0');
  });
});
