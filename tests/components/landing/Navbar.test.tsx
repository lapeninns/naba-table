import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Navbar } from '@/components/landing/shared/Navbar';

describe('landing Navbar', () => {
  it('@smoke @a11y renders the navigation with anchor links and the CTA', () => {
    render(<Navbar isAuthenticated={false} />);

    const nav = screen.getAllByRole('navigation')[0];
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'The System' })).toHaveAttribute('href', '#system');
    expect(screen.getByRole('link', { name: 'The Value Stack' })).toHaveAttribute(
      'href',
      '#value-stack',
    );
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');
    expect(screen.getByRole('link', { name: "Claim Your Pub's Spot" })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('@contract shows Member Login pointing at /auth for anonymous visitors', () => {
    render(<Navbar isAuthenticated={false} />);

    expect(screen.getByRole('link', { name: 'Member Login' })).toHaveAttribute('href', '/auth');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('@contract swaps to a Dashboard link for authenticated guests', () => {
    render(<Navbar isAuthenticated />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/guest/dashboard',
    );
    expect(screen.queryByRole('link', { name: 'Member Login' })).not.toBeInTheDocument();
  });

  it('@contract @a11y opens the mobile menu sheet with nav links and closes on navigate', async () => {
    const user = userEvent.setup();
    render(<Navbar isAuthenticated={false} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const sheet = await screen.findByRole('dialog', { name: 'Menu' });
    const sheetLinks = within(sheet);
    expect(sheetLinks.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');
    expect(sheetLinks.getByRole('link', { name: 'Member Login' })).toHaveAttribute(
      'href',
      '/auth',
    );

    await user.click(sheetLinks.getByRole('link', { name: 'FAQ' }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
