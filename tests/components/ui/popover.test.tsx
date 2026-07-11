import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

describe('ui/popover', () => {
  it('@smoke keeps content hidden until triggered', () => {
    render(
      <Popover>
        <PopoverTrigger>Open filters</PopoverTrigger>
        <PopoverContent>Filter body</PopoverContent>
      </Popover>,
    );

    expect(screen.queryByText('Filter body')).not.toBeInTheDocument();
  });

  it('@contract opens on trigger click and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open filters</PopoverTrigger>
        <PopoverContent>Filter body</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Open filters' }));
    expect(await screen.findByText('Filter body')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Filter body')).not.toBeInTheDocument();
  });

  it('@smoke content merges custom classes with popover styling', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent className="w-96">Wide body</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Wide body')).toHaveClass('w-96', 'rounded-md');
  });
});
