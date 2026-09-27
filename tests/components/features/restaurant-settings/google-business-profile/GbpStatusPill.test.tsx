import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  GbpStatusPill,
  gbpToneBadgeVariant,
} from '@/components/features/restaurant-settings/google-business-profile/components/GbpStatusPill';

describe('GbpStatusPill', () => {
  it('@contract maps tones to the shared status Badge variants', () => {
    expect(gbpToneBadgeVariant('ok')).toBe('status-confirmed');
    expect(gbpToneBadgeVariant('off')).toBe('status-completed');
    expect(gbpToneBadgeVariant('bad')).toBe('status-cancelled');
  });

  it('@a11y renders a text label and value; the dot is only decorative', () => {
    const { container } = render(
      <GbpStatusPill label="Connection" value="Not connected" tone="off" />,
    );

    const pill = container.firstElementChild;
    expect(pill).toHaveTextContent('Connection Not connected');
    expect(pill).toHaveClass('rounded-full', 'text-xs', 'bg-secondary');
    expect(pill?.className).not.toContain('min-h-[30px]');
    expect(screen.getByText('Not connected')).toHaveClass('font-semibold');
    // The dot never carries the state on its own.
    const dot = pill?.querySelector('[data-slot="gbp-status-dot"]');
    expect(dot).toHaveAttribute('aria-hidden');
    expect(dot).toHaveTextContent('');
  });

  it('@regression keeps the label and value as separate Badge items so the gap spaces them', () => {
    // A Badge is inline-flex: a bare "Connection " text node loses its trailing space, which
    // rendered "ConnectionNot connected".
    const { container } = render(
      <GbpStatusPill label="Connection" value="Not connected" tone="off" />,
    );

    const pill = container.firstElementChild;
    expect(pill).toHaveClass('inline-flex', 'gap-1.5');
    const label = screen.getByText('Connection');
    const value = screen.getByText('Not connected');
    expect(label.tagName).toBe('SPAN');
    expect(label.parentElement).toBe(pill);
    expect(value.parentElement).toBe(pill);
    // No text node carries the label: anything left between the items is whitespace only.
    for (const node of Array.from(pill?.childNodes ?? [])) {
      if (node.nodeType === Node.TEXT_NODE) expect(node.textContent?.trim()).toBe('');
    }
  });
});
