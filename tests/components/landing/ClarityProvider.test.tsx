import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/pricing',
}));

async function importClarityProvider() {
  const module = await import('@/components/landing/analytics/ClarityProvider');
  return module.ClarityProvider;
}

afterEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  delete window.clarity;
  document.head.querySelectorAll('script[src*="clarity.ms"]').forEach((el) => el.remove());
});

describe('ClarityProvider', () => {
  it('@contract renders nothing and injects no script without a project id', async () => {
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    const ClarityProvider = await importClarityProvider();

    const { container } = render(<ClarityProvider />);

    expect(container).toBeEmptyDOMElement();
    expect(document.head.querySelector('script[src*="clarity.ms"]')).toBeNull();
  });

  it('@contract injects the clarity tag and reports the page when configured', async () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = 'proj123';
    const clarity = vi.fn();
    window.clarity = clarity;
    const ClarityProvider = await importClarityProvider();

    render(<ClarityProvider />);

    const script = document.head.querySelector('script[src*="clarity.ms"]');
    expect(script).not.toBeNull();
    expect(script).toHaveAttribute('src', 'https://www.clarity.ms/tag/proj123');
    expect(clarity).toHaveBeenCalledWith('set', 'page', '/pricing');
  });
});
