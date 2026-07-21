import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Heading, Text } from '@/components/ui/typography';

describe('ui/typography', () => {
  it('@smoke renders a Heading with the variant classes and default element', () => {
    render(<Heading variant="display">Full house</Heading>);
    const el = screen.getByRole('heading', { level: 1, name: 'Full house' });
    // Display binds to the Merriweather display token, not a raw text size.
    expect(el.className).toContain('font-[family-name:var(--pg-font-display)]');
    expect(el.className).toContain('text-[length:var(--pg-text-hero)]');
  });

  it('@contract maps each heading variant to its semantic default element', () => {
    const { rerender } = render(<Heading variant="section">S</Heading>);
    expect(screen.getByText('S').tagName).toBe('H2');
    rerender(<Heading variant="card">C</Heading>);
    expect(screen.getByText('C').tagName).toBe('H3');
  });

  it('@contract honors the `as` override for the rendered element', () => {
    render(
      <Heading variant="display" as="h3">
        Overridden
      </Heading>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Overridden' })).toBeInTheDocument();
  });

  it('@smoke renders Text as a <p> by default and honors `as`', () => {
    const { rerender } = render(<Text variant="body">Body copy</Text>);
    expect(screen.getByText('Body copy').tagName).toBe('P');
    rerender(
      <Text variant="mono" as="span">
        07700 900123
      </Text>,
    );
    const mono = screen.getByText('07700 900123');
    expect(mono.tagName).toBe('SPAN');
    expect(mono.className).toContain('font-[family-name:var(--pg-font-mono)]');
    expect(mono.className).toContain('tabular-nums');
  });

  it('@smoke passes className through and merges without dropping variant styles', () => {
    render(
      <Text variant="caption" className="mt-4">
        Meta
      </Text>,
    );
    const el = screen.getByText('Meta');
    expect(el.className).toContain('mt-4');
    expect(el.className).toContain('text-[length:var(--pg-text-caption)]');
  });
});
