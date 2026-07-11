import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Phone } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { ContactInfoRow } from '@/components/features/dashboard/booking-details/components/ContactInfoRow';

describe('ContactInfoRow', () => {
  it('@contract renders the value as a link when an href is given', () => {
    render(
      <ContactInfoRow icon={Phone} label="Phone" value="+44 7700 900123" href="tel:+447700900123" />,
    );

    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+44 7700 900123' })).toHaveAttribute(
      'href',
      'tel:+447700900123',
    );
  });

  it('@contract renders a plain value without an href', () => {
    render(<ContactInfoRow icon={Phone} label="Phone" value="Reception desk" />);

    expect(screen.getByText('Reception desk')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('@contract renders the copy affordance in copyable mode', () => {
    render(<ContactInfoRow icon={Phone} label="Phone" value="+44 7700 900123" copyable />);

    expect(screen.getByRole('button', { name: 'Copy Phone' })).toBeInTheDocument();
  });

  it('@contract renders link actions and click actions side by side', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ContactInfoRow
        icon={Phone}
        label="Phone"
        value="+44 7700 900123"
        actions={[
          { label: 'WhatsApp', href: 'https://wa.me/447700900123' },
          { label: 'Log call', onClick },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/447700900123',
    );
    await user.click(screen.getByRole('button', { name: 'Log call' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
