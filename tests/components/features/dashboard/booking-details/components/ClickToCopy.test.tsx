import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ClickToCopy } from '@/components/features/dashboard/booking-details/components/ClickToCopy';

describe('ClickToCopy', () => {
  it('@contract renders the value with an accessible copy control', () => {
    render(<ClickToCopy text="REF-1234" label="reference" />);

    const button = screen.getByRole('button', { name: 'Copy reference' });
    expect(button).toHaveTextContent('REF-1234');
  });

  it('@contract writes the text to the clipboard on click', async () => {
    // userEvent.setup() installs a working clipboard stub in jsdom.
    const user = userEvent.setup();
    render(<ClickToCopy text="REF-1234" label="reference" />);

    await user.click(screen.getByRole('button', { name: 'Copy reference' }));

    await expect(navigator.clipboard.readText()).resolves.toBe('REF-1234');
  });
});
