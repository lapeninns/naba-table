import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShieldCheck } from 'lucide-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared/RestaurantSettingsCommandCenter';

function renderCenter(over: Partial<Parameters<typeof RestaurantSettingsCommandCenter>[0]> = {}) {
  render(
    <RestaurantSettingsCommandCenter
      eyebrow="Google command center"
      title="Google Business Profile"
      description="Connect Google for imports and comparisons."
      metrics={[
        {
          label: 'Connection',
          value: 'Linked',
          description: 'owner@example.com',
          Icon: ShieldCheck,
        },
      ]}
      railTitle="Google workflow"
      railItems={[{ label: 'Connection', onSelect: vi.fn(), isActive: true }]}
      footer={<span>Related settings live elsewhere.</span>}
      {...over}
    >
      <p>Workspace content</p>
    </RestaurantSettingsCommandCenter>,
  );
}

describe('RestaurantSettingsCommandCenter', () => {
  it('@smoke renders header, metrics, rail, footer, and children', () => {
    renderCenter();

    // The chrome h1 is the only title; the command centre must not repeat it as a heading.
    expect(screen.queryByText('Google command center')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Google Business Profile' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Google Business Profile summary')).toBeInTheDocument();
    expect(screen.getByText('Connect Google for imports and comparisons.')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    const rail = screen.getByRole('navigation', { name: 'Google workflow' });
    expect(within(rail).getByRole('button', { name: /Connection/ })).toBeInTheDocument();
    expect(screen.getByText('Related settings live elsewhere.')).toBeInTheDocument();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('@contract can hide the header and metrics for embedded use', () => {
    renderCenter({ showHeader: false });

    expect(
      screen.queryByText('Connect Google for imports and comparisons.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Linked')).not.toBeInTheDocument();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('@contract routes rail selections and renders the primary action slot', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCenter({
      railItems: [{ label: 'Review changes', onSelect, badge: 'Next' }],
      primaryAction: <button type="button">Primary action</button>,
    });

    expect(screen.getByRole('button', { name: 'Primary action' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Review changes/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  describe('with reduced motion', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it.each([
      { label: 'reduced motion', reduce: true },
      { label: 'default motion', reduce: false },
    ])('@a11y never leaves the page content invisible ($label)', ({ reduce }) => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: reduce && query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      renderCenter();

      const section = screen.getByText('Workspace content').closest('section');
      expect(section).not.toBeNull();
      // Checked synchronously on first render: no JS-driven initial opacity to wait out.
      expect(section).not.toHaveStyle({ opacity: '0' });
      expect(section?.getAttribute('style') ?? '').not.toMatch(/opacity|transform/);

      // CSS fade: every animation utility is gated behind `motion-safe:` so reduced-motion users
      // get no animation, and no fill mode holds the keyframe start, so it always ends visible.
      const classes = Array.from(section?.classList ?? []);
      expect(classes).toEqual(
        expect.arrayContaining(['motion-safe:animate-in', 'motion-safe:fade-in-0']),
      );
      const animationClasses = classes.filter((className) =>
        /(^|:)(animate-|fade-|slide-in-|zoom-in-|duration-|ease-|delay-|fill-mode-)/.test(
          className,
        ),
      );
      expect(animationClasses.filter((className) => !className.startsWith('motion-safe:'))).toEqual(
        [],
      );
      expect(classes.filter((className) => className.includes('fill-mode-'))).toEqual([]);
    });

    it('@perf fades with CSS instead of loading the motion runtime', () => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          'src/components/features/restaurant-settings/shared/RestaurantSettingsCommandCenter.tsx',
        ),
        'utf8',
      );

      expect(source).not.toMatch(/from ['"]motion(\/[^'"]*)?['"]/);
    });
  });
});
