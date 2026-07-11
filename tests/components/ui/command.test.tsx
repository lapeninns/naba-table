import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

function renderPalette(onSelect = vi.fn()) {
  render(
    <Command>
      <CommandInput placeholder="Search actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Bookings">
          <CommandItem onSelect={onSelect} value="new-booking">
            New booking
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem value="print-run">Print run sheet</CommandItem>
        </CommandGroup>
        <CommandSeparator />
      </CommandList>
    </Command>,
  );
  return { onSelect };
}

describe('ui/command', () => {
  it('@smoke renders the palette with input, group heading, and items', () => {
    renderPalette();

    expect(screen.getByPlaceholderText('Search actions...')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('New booking')).toBeInTheDocument();
    expect(screen.getByText('⌘B')).toBeInTheDocument();
  });

  it('@contract typing filters items and shows the empty state for no matches', async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByPlaceholderText('Search actions...'), 'print');
    expect(screen.getByText('Print run sheet')).toBeInTheDocument();
    expect(screen.queryByText('New booking')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search actions...'));
    await user.type(screen.getByPlaceholderText('Search actions...'), 'zzz');
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('@contract selecting an item fires onSelect with its value', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPalette();

    await user.click(screen.getByText('New booking'));

    expect(onSelect).toHaveBeenCalledWith('new-booking');
  });
});
