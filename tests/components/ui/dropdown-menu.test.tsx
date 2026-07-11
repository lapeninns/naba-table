import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function renderMenu(handlers: { onEdit?: () => void; onDelete?: () => void } = {}) {
  return render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Row actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={handlers.onEdit}>
          Edit
          <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handlers.onDelete}>
          Delete
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Show archived</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('ui/dropdown-menu', () => {
  it('@smoke keeps the menu closed until the trigger is clicked', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('@contract @a11y opens a menu with items, label, and shortcut', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Row actions')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByText('⌘E')).toBeInTheDocument();
  });

  it('@contract selecting an item fires its handler and closes the menu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu({ onEdit });

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('@contract destructive items carry the destructive variant hook', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('@contract @a11y checkbox items expose their checked state', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(
      await screen.findByRole('menuitemcheckbox', { name: 'Show archived' }),
    ).toHaveAttribute('aria-checked', 'true');
  });
});
