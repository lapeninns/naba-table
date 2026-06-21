import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StaleBoundary } from '@/components/ui/stale-boundary';

describe('StaleBoundary', () => {
  it('renders children without stale styling when isStale is false', () => {
    render(
      <StaleBoundary isStale={false}>
        <p>Content</p>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Content').parentElement!;
    expect(boundary).toHaveAttribute('aria-busy', 'false');
    expect(boundary).not.toHaveClass('opacity-60');
  });

  it('marks the wrapper as aria-busy when stale', () => {
    render(
      <StaleBoundary isStale={true}>
        <p>Stale content</p>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Stale content').parentElement!;
    expect(boundary).toHaveAttribute('aria-busy', 'true');
  });

  it('applies stale visual classes when isStale is true', () => {
    render(
      <StaleBoundary isStale={true}>
        <p>Stale content</p>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Stale content').parentElement!;
    expect(boundary).toHaveClass('opacity-60');
    expect(boundary).toHaveClass('pointer-events-none');
  });

  it('makes stale descendants inert to keyboard activation', () => {
    render(
      <StaleBoundary isStale={true}>
        <button type="button">Stale action</button>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Stale action').parentElement!;
    expect(boundary).toHaveAttribute('inert');
    // `inert` (not a forced aria-hidden) handles non-interactivity. We must NOT
    // also set aria-hidden when stale: pairing it with aria-busy is contradictory
    // (aria-hidden would remove the busy state from the a11y tree). (#14)
    expect(boundary).toHaveAttribute('aria-busy', 'true');
    expect(boundary).not.toHaveAttribute('aria-hidden');
  });

  it('does not apply pointer-events-none when not stale', () => {
    render(
      <StaleBoundary isStale={false}>
        <p>Interactive content</p>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Interactive content').parentElement!;
    expect(boundary).not.toHaveClass('pointer-events-none');
    expect(boundary).not.toHaveAttribute('inert');
  });

  it('merges custom className', () => {
    render(
      <StaleBoundary isStale={false} className="my-custom-class">
        <p>Content</p>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Content').parentElement!;
    expect(boundary).toHaveClass('my-custom-class');
  });

  it('exposes the data-slot attribute', () => {
    render(
      <StaleBoundary isStale={false}>
        <p>Content</p>
      </StaleBoundary>,
    );

    const boundary = screen.getByText('Content').parentElement!;
    expect(boundary).toHaveAttribute('data-slot', 'stale-boundary');
  });

  it('passes through additional HTML attributes', () => {
    render(
      <StaleBoundary isStale={false} data-testid="stale-wrapper" id="my-boundary">
        <p>Content</p>
      </StaleBoundary>,
    );

    expect(screen.getByTestId('stale-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('stale-wrapper')).toHaveAttribute('id', 'my-boundary');
  });
});
