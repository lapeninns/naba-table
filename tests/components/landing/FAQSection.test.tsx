import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FAQSection } from '@/components/landing/sections/FAQSection';

describe('FAQSection', () => {
  it('@smoke @a11y renders the faq anchor with all three questions collapsed', () => {
    const { container } = render(<FAQSection />);

    expect(container.querySelector('section#faq')).not.toBeNull();
    for (const question of [
      'Is this just another basic booking form?',
      'Will this actually stop no-shows?',
      "I don't have time to set this up. Is it hard?",
    ]) {
      expect(screen.getByRole('button', { name: question })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }
  });

  it('@contract expands a question to reveal its answer', async () => {
    const user = userEvent.setup();
    render(<FAQSection />);

    await user.click(screen.getByRole('button', { name: 'Will this actually stop no-shows?' }));

    expect(
      screen.getByText(/automated SMS and email sequences combined with guest-history tracking/),
    ).toBeInTheDocument();
  });

  it('@contract opening a second question collapses the first (single mode)', async () => {
    const user = userEvent.setup();
    render(<FAQSection />);

    const first = screen.getByRole('button', { name: 'Is this just another basic booking form?' });
    await user.click(first);
    await user.click(screen.getByRole('button', { name: "I don't have time to set this up. Is it hard?" }));

    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/White-Glove Setup support/)).toBeInTheDocument();
  });
});
