import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HowItWorksSection } from '@/components/landing/sections/HowItWorksSection';

describe('HowItWorksSection', () => {
  it('@smoke renders the white-glove heading', () => {
    render(<HowItWorksSection />);

    expect(
      screen.getByRole('heading', { name: 'We build it around how your pub already runs.' }),
    ).toBeInTheDocument();
  });

  it('@smoke renders the three numbered steps in order', () => {
    render(<HowItWorksSection />);

    for (const [number, title] of [
      ['1', 'We map your service'],
      ['2', 'We install the automations'],
      ['3', 'Your team runs from one board'],
    ] as const) {
      expect(screen.getByText(number)).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });
});
