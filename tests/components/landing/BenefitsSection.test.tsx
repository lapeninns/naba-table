import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BenefitsSection } from '@/components/landing/sections/BenefitsSection';

describe('BenefitsSection', () => {
  it('@smoke @a11y renders the value-stack anchor with its heading', () => {
    const { container } = render(<BenefitsSection />);

    expect(container.querySelector('section#value-stack')).not.toBeNull();
    expect(
      screen.getByRole('heading', {
        name: 'Nabatable is the layer between online demand and a calm service.',
      }),
    ).toBeInTheDocument();
  });

  it('@smoke renders all six benefit cards with their value badges', () => {
    render(<BenefitsSection />);

    for (const value of ['Capture', 'Remind', 'Control', 'Visibility', 'Recover', 'Installed']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(
      screen.getByText('Your pub stays bookable after the phone stops being answered.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'White-Glove setup means your team does not inherit a configuration project.',
      ),
    ).toBeInTheDocument();
  });

  it('@smoke shows the objection-handling chips', () => {
    render(<BenefitsSection />);

    for (const chip of ['No lock-in contracts', 'Transparent service logs', 'White-Glove setup']) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
  });
});
