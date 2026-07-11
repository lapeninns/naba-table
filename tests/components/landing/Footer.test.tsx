import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Footer } from '@/components/landing/shared/Footer';

describe('landing Footer', () => {
  it('@smoke @a11y renders the footer with brand and tagline', () => {
    render(<Footer />);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Nabatable')).toBeInTheDocument();
    expect(
      screen.getByText(/reservations and capacity growth system for modern food-led UK pubs/),
    ).toBeInTheDocument();
  });

  it('@contract links product anchors and company pages to the right hrefs', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'The System' })).toHaveAttribute('href', '#system');
    expect(screen.getByRole('link', { name: 'Value Stack' })).toHaveAttribute(
      'href',
      '#value-stack',
    );
    expect(screen.getByRole('link', { name: 'Guarantee' })).toHaveAttribute('href', '#guarantee');
    expect(screen.getByRole('link', { name: 'Restaurants' })).toHaveAttribute(
      'href',
      '/restaurants',
    );
    expect(screen.getByRole('link', { name: 'My bookings' })).toHaveAttribute(
      'href',
      '/bookings',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  it('@smoke shows the copyright and system status line', () => {
    render(<Footer />);

    expect(screen.getByText(/© 2026 Nabatable Inc\./)).toBeInTheDocument();
    expect(screen.getByText('System operational')).toBeInTheDocument();
  });
});
