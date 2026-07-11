import { render, screen } from '@testing-library/react';
import { mockAllIsIntersecting, setupIntersectionMocking } from 'react-intersection-observer/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LandingPage } from '@/components/landing/LandingPage';

beforeEach(() => {
  setupIntersectionMocking(vi.fn);
  // The config-level mockReset wipes the setup-file matchMedia vi.fn
  // implementation; LandingPage reads matchMedia on mount for reduced motion.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('LandingPage', () => {
  it('@smoke @a11y assembles nav, hero, main landmark, and footer', () => {
    render(<LandingPage isAuthenticated={false} />);

    expect(document.getElementById('main-content')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: /keeps your pub service full/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Member Login' })).toHaveAttribute('href', '/auth');
  });

  it('@contract lazily reveals the below-the-fold sections once they intersect', () => {
    render(<LandingPage isAuthenticated={false} />);

    expect(screen.queryByText('Booking capture')).not.toBeInTheDocument();

    mockAllIsIntersecting(true);

    expect(screen.getByText('Booking capture')).toBeInTheDocument();
    expect(screen.getByText('Risk Reversal')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Will this actually stop no-shows?' }),
    ).toBeInTheDocument();
  });

  it('@contract emits the JSON-LD schema exactly once', () => {
    const { container } = render(<LandingPage isAuthenticated={false} />);

    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  });

  it('@contract threads authentication through to the navbar', () => {
    render(<LandingPage isAuthenticated />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/guest/dashboard',
    );
  });
});
