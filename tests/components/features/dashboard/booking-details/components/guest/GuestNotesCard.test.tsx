import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GuestNotesCard } from '@/components/features/dashboard/booking-details/components/guest/GuestNotesCard';

describe('GuestNotesCard', () => {
  it('@contract renders nothing when both note sources are empty', () => {
    const { container } = render(<GuestNotesCard bookingNotes={null} profileNotes={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract expands booking notes with their copy affordance', async () => {
    const user = userEvent.setup();
    render(<GuestNotesCard bookingNotes="Window seat please" profileNotes={null} />);

    expect(screen.queryByText('Profile History')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Booking Notes/ }));

    // The note text appears twice once expanded: the note body and the
    // ClickToCopy button's truncated preview.
    const matches = await screen.findAllByText('Window seat please');
    expect(matches.length).toBe(2);
    expect(screen.getByRole('button', { name: 'Copy notes' })).toBeInTheDocument();
  });

  it('@contract expands profile history independently', async () => {
    const user = userEvent.setup();
    render(<GuestNotesCard bookingNotes={null} profileNotes="Regular — prefers corner table" />);

    await user.click(screen.getByRole('button', { name: /Profile History/ }));

    expect(await screen.findByText('Regular — prefers corner table')).toBeVisible();
  });
});
