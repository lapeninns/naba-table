import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Iframe } from '@/components/ui/iframe';

describe('ui/iframe', () => {
  it('@smoke @a11y renders an iframe with title and src forwarded', () => {
    render(<Iframe title="Email preview" src="about:blank" />);

    const frame = screen.getByTitle('Email preview');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'about:blank');
  });

  it('@smoke merges the background class with custom classes', () => {
    render(<Iframe title="Styled frame" className="h-96" />);

    expect(screen.getByTitle('Styled frame')).toHaveClass('bg-background', 'h-96');
  });
});
