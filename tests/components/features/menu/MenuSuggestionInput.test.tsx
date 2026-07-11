import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MenuSuggestionInput } from '@/components/features/menu/MenuSuggestionInput';

describe('MenuSuggestionInput', () => {
  it('@contract reports typed input through onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <MenuSuggestionInput
        aria-label="Section name"
        value=""
        suggestions={['Starters', 'Mains']}
        onValueChange={onValueChange}
      />,
    );

    await user.type(screen.getByLabelText('Section name'), 'S');
    expect(onValueChange).toHaveBeenCalledWith('S');
  });

  it('@contract opens matching suggestions on focus and filters by the current value', async () => {
    const user = userEvent.setup();
    render(
      <MenuSuggestionInput
        aria-label="Section name"
        value="star"
        suggestions={['Starters', 'Mains', 'Star fruit salad']}
        onValueChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Section name'));

    expect(await screen.findByText('Starters')).toBeInTheDocument();
    expect(screen.getByText('Star fruit salad')).toBeInTheDocument();
    expect(screen.queryByText('Mains')).not.toBeInTheDocument();
  });

  it('@contract selecting a suggestion emits it and closes the popover', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <MenuSuggestionInput
        aria-label="Section name"
        value="star"
        suggestions={['Starters']}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByLabelText('Section name'));
    await user.click(await screen.findByText('Starters'));

    expect(onValueChange).toHaveBeenCalledWith('Starters');
  });

  it('@contract caps the list via maxSuggestions and deduplicates entries', async () => {
    const user = userEvent.setup();
    render(
      <MenuSuggestionInput
        aria-label="Section name"
        value=""
        suggestions={['One', 'One', 'Two', 'Three']}
        maxSuggestions={2}
        onValueChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Section name'));

    expect(await screen.findByText('One')).toBeInTheDocument();
    expect(screen.getAllByText('One')).toHaveLength(1);
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();
  });

  it('@smoke stays closed when nothing matches', async () => {
    const user = userEvent.setup();
    render(
      <MenuSuggestionInput
        aria-label="Section name"
        value="zzz"
        suggestions={['Starters']}
        onValueChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Section name'));
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
  });
});
