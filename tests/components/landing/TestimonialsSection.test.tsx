import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestimonialsSection } from '@/components/landing/sections/TestimonialsSection';

describe('TestimonialsSection', () => {
  it('@smoke renders the proof heading and objection chips', () => {
    render(<TestimonialsSection />);

    expect(
      screen.getByRole('heading', { name: 'Calmer service is the proof.' }),
    ).toBeInTheDocument();
    for (const point of ['Setup handled', 'Cancel Anytime', 'No lock-in', 'Data imported']) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
  });

  it('@contract attributes quotes to venue names stripped of their towns', () => {
    render(<TestimonialsSection />);

    // venueNameFromLabel drops the " — <town>" suffix from LOCAL_VENUES.
    expect(screen.getByText('The Barley Mow Pub')).toBeInTheDocument();
    expect(screen.getByText('White Horse Pub')).toBeInTheDocument();
    expect(screen.getByText('The Corner House Pub')).toBeInTheDocument();
    expect(screen.queryByText(/— Hartford/)).not.toBeInTheDocument();
  });

  it('@smoke renders all eight testimonial quotes', () => {
    const { container } = render(<TestimonialsSection />);

    expect(container.querySelectorAll('blockquote')).toHaveLength(8);
    expect(screen.getByText(/booking flow calmer almost immediately/)).toBeInTheDocument();
  });
});
