import { createRef } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScrollArea } from '@/components/ui/scroll-area';

describe('ui/scroll-area', () => {
  it('@smoke renders children inside a scrollable viewport', () => {
    render(
      <ScrollArea className="h-40">
        <p>Long content</p>
      </ScrollArea>,
    );

    expect(screen.getByText('Long content')).toBeInTheDocument();
  });

  it('@contract exposes the viewport through viewportRef', () => {
    const viewportRef = createRef<HTMLDivElement>();
    render(
      <ScrollArea viewportRef={viewportRef}>
        <p>Body</p>
      </ScrollArea>,
    );

    expect(viewportRef.current).toBeInstanceOf(HTMLDivElement);
    expect(viewportRef.current).toContainElement(screen.getByText('Body'));
  });

  it('@smoke the viewport forces vertical scrolling and suppresses horizontal', () => {
    // Radix never mounts the scrollbar thumbs in jsdom (no overflow), so the
    // observable contract is the viewport override this wrapper adds.
    const { container } = render(
      <ScrollArea>
        <p>Body</p>
      </ScrollArea>,
    );

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
    expect(viewport).toHaveClass('!overflow-y-scroll', '!overflow-x-hidden');
  });
});
