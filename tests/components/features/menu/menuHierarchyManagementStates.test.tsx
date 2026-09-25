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
import { HttpError } from '@/lib/http/errors';

describe('menuHierarchyManagementStates', () => {
  it('@smoke SelectRestaurantMenuState prompts for a restaurant', () => {
    render(<SelectRestaurantMenuState />);

    expect(screen.getByText('Select a restaurant')).toBeInTheDocument();
    expect(
      screen.getByText('Choose an active restaurant before editing its menu structure.'),
    ).toBeInTheDocument();
  });

  it('@contract MenuLoadErrorState says saved menus are unchanged and offers Try again', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <MenuLoadErrorState
        error={new HttpError({ message: 'Guest data here', status: 503, code: 'HTTP_503' })}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Menus could not be loaded')).toBeInTheDocument();
    expect(
      screen.getByText('Your saved menus are unchanged. Reason code HTTP_503.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Guest data here/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<MenuLoadErrorState error={new Error('Network exploded')} onRetry={onRetry} />);
    expect(screen.queryByText(/Network exploded/)).not.toBeInTheDocument();
    expect(screen.getByText(/Your saved menus are unchanged/)).toBeInTheDocument();
  });

  it('@smoke MenuLoadingState renders the loading copy', () => {
    render(<MenuLoadingState />);

    expect(screen.getByText('Loading menus…')).toBeInTheDocument();
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

    expect(screen.getByText('No drinks menu yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create drinks menu' }));
    expect(onCreateMenu).toHaveBeenCalledTimes(1);

    rerender(<EmptyPreferredMenuState preferredMenuKind="food" onCreateMenu={onCreateMenu} />);
    expect(screen.getByText('No food menu yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create food menu' })).toBeInTheDocument();
  });
});
