import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CTASection } from '@/components/landing/sections/CTASection';

describe('CTASection', () => {
  it('@smoke renders the closing pitch heading and reassurance line', () => {
    render(<CTASection />);

    expect(
      screen.getByText('Ready to see what your next service could look like?'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('White-Glove setup included. No lock-in contracts.'),
    ).toBeInTheDocument();
  });

  it('@contract points both CTAs at contact and the system anchor', () => {
    render(<CTASection />);

    expect(screen.getByRole('link', { name: 'Claim a setup slot' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByRole('link', { name: 'Review the system' })).toHaveAttribute(
      'href',
      '#system',
    );
  });
});
