import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProblemSection } from '@/components/landing/sections/ProblemSection';

describe('ProblemSection', () => {
  it('@smoke @a11y renders the system anchor section with its heading', () => {
    const { container } = render(<ProblemSection />);

    expect(container.querySelector('section#system')).not.toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Empty tables rarely start as empty tables.' }),
    ).toBeInTheDocument();
  });

  it('@smoke numbers the three service leaks', () => {
    render(<ProblemSection />);

    expect(screen.getByText(/Guests book, then drift/)).toBeInTheDocument();
    expect(screen.getByText(/Tables get filled in the wrong order/)).toBeInTheDocument();
    expect(screen.getByText(/Managers start the shift without one clean view/)).toBeInTheDocument();
    for (const index of ['1', '2', '3']) {
      expect(screen.getByText(index)).toBeInTheDocument();
    }
  });

  it('@smoke lists the four blueprint features', () => {
    render(<ProblemSection />);

    for (const title of [
      'Booking capture',
      'No-show prompts',
      'Floor protection',
      'Manager visibility',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });
});
