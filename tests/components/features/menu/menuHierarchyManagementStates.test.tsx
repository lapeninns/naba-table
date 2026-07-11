import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EmptyMenuState,
  EmptyPreferredMenuState,
  MenuLoadErrorState,
  MenuLoadingState,
  SelectRestaurantMenuState,
} from '@/components/features/menu/menuHierarchyManagementStates';

describe('menuHierarchyManagementStates', () => {
  it('@smoke SelectRestaurantMenuState prompts for a restaurant', () => {
    render(<SelectRestaurantMenuState />);

    expect(screen.getByText('Select a restaurant')).toBeInTheDocument();
    expect(
      screen.getByText('Choose an active restaurant before editing its menu structure.'),
    ).toBeInTheDocument();
  });

  it('@contract MenuLoadErrorState shows the error message and retries on click', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<MenuLoadErrorState errorMessage="Network exploded" onRetry={onRetry} />);

    expect(screen.getByText('Unable to load menus')).toBeInTheDocument();
    expect(screen.getByText('Network exploded')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke MenuLoadingState renders the loading copy', () => {
    render(<MenuLoadingState />);

    expect(screen.getByText('Loading menus...')).toBeInTheDocument();
  });

  it('@contract EmptyMenuState invites creating the first menu', async () => {
    const user = userEvent.setup();
    const onCreateMenu = vi.fn();
    render(<EmptyMenuState onCreateMenu={onCreateMenu} />);

    expect(screen.getByText('No menus yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create menu' }));
    expect(onCreateMenu).toHaveBeenCalledTimes(1);
  });

  it('@contract EmptyPreferredMenuState labels the missing menu kind', async () => {
    const user = userEvent.setup();
    const onCreateMenu = vi.fn();
    const { rerender } = render(
      <EmptyPreferredMenuState preferredMenuKind="drinks" onCreateMenu={onCreateMenu} />,
    );

    expect(screen.getByText('No drinks menu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create drinks menu' }));
    expect(onCreateMenu).toHaveBeenCalledTimes(1);

    rerender(<EmptyPreferredMenuState preferredMenuKind="food" onCreateMenu={onCreateMenu} />);
    expect(screen.getByText('No food menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create food menu' })).toBeInTheDocument();
  });
});
