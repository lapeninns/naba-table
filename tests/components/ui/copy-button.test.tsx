import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CopyButton } from '@/components/ui/copy-button';

describe('ui/copy-button', () => {
  it('@smoke @a11y labels the button from the label prop', () => {
    render(<CopyButton text="hello" label="booking link" />);

    expect(screen.getByRole('button', { name: 'Copy booking link' })).toBeInTheDocument();
  });

  it('@contract copies the text to the clipboard and flips to the copied state', async () => {
    // userEvent stubs navigator.clipboard, letting the real hook resolve.
    const user = userEvent.setup();
    render(<CopyButton text="table-42" label="table id" />);

    await user.click(screen.getByRole('button', { name: 'Copy table id' }));

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    expect(await window.navigator.clipboard.readText()).toBe('table-42');
  });

  it('@smoke falls back to a generic label without one', () => {
    render(<CopyButton text="x" />);

    expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
  });
});
