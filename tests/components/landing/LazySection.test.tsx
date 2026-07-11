import { render, screen } from '@testing-library/react';
import { mockAllIsIntersecting, setupIntersectionMocking } from 'react-intersection-observer/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LazySection } from '@/components/landing/optimizations/LazySection';

beforeEach(() => {
  setupIntersectionMocking(vi.fn);
});

describe('LazySection', () => {
  it('@contract renders the fallback until the section scrolls into view', () => {
    render(
      <LazySection fallback={<p>Loading section...</p>}>
        <p>Heavy content</p>
      </LazySection>,
    );

    expect(screen.getByText('Loading section...')).toBeInTheDocument();
    expect(screen.queryByText('Heavy content')).not.toBeInTheDocument();
  });

  it('@contract swaps in the children once intersecting', () => {
    render(
      <LazySection fallback={<p>Loading section...</p>}>
        <p>Heavy content</p>
      </LazySection>,
    );

    mockAllIsIntersecting(true);

    expect(screen.getByText('Heavy content')).toBeInTheDocument();
    expect(screen.queryByText('Loading section...')).not.toBeInTheDocument();
  });

  it('@smoke defaults to an empty placeholder and forwards className', () => {
    const { container } = render(
      <LazySection className="min-h-96">
        <p>Deferred</p>
      </LazySection>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('min-h-96');
    expect(wrapper).toBeEmptyDOMElement();
  });
});
