import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroSection } from '@/components/landing/sections/HeroSection';

describe('HeroSection', () => {
  it('@smoke @a11y renders the headline and positioning badges', () => {
    render(<HeroSection />);

    expect(
      screen.getByRole('heading', { level: 1, name: /keeps your pub service full, confirmed/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Built for food-led UK pubs')).toBeInTheDocument();
    expect(screen.getByText('White-Glove setup included')).toBeInTheDocument();
  });

  it('@contract links both calls to action to the right targets', () => {
    render(<HeroSection />);

    expect(screen.getByRole('link', { name: 'Claim a setup slot' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByRole('link', { name: 'See the system' })).toHaveAttribute(
      'href',
      '#system',
    );
  });

  it('@smoke shows the shift status stats and signals', () => {
    render(<HeroSection />);

    expect(screen.getByText('covers protected tonight')).toBeInTheDocument();
    expect(screen.getByText('manual chases removed')).toBeInTheDocument();
    expect(screen.getByText('setup spots open')).toBeInTheDocument();
    expect(screen.getByText('No-show risk')).toBeInTheDocument();
    expect(screen.getByText('Handled')).toBeInTheDocument();
  });

  it('@smoke embeds the live feed card preview', () => {
    render(<HeroSection />);

    expect(screen.getByText(/service board/i)).toBeInTheDocument();
  });
});
