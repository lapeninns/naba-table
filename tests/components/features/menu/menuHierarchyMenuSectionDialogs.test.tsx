import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MenuDialog,
  SectionDialog,
} from '@/components/features/menu/menuHierarchyMenuSectionDialogs';

import {
  makeMenu,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  createMenu: undefined as unknown as MutationStub,
  updateMenu: undefined as unknown as MutationStub,
  createSection: undefined as unknown as MutationStub,
  updateSection: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsCreateRestaurantMenu: () => hooks.createMenu,
  useOpsUpdateRestaurantMenu: () => hooks.updateMenu,
  useOpsCreateRestaurantMenuSection: () => hooks.createSection,
  useOpsUpdateRestaurantMenuSection: () => hooks.updateSection,
}));

beforeEach(() => {
  hooks.createMenu = mutationStub();
  hooks.updateMenu = mutationStub();
  hooks.createSection = mutationStub();
  hooks.updateSection = mutationStub();
});

describe('MenuDialog', () => {
  function renderMenuDialog(overrides: Partial<Parameters<typeof MenuDialog>[0]> = {}) {
    const props = {
      restaurantId: 'rest-1',
      mode: 'create' as const,
      menu: null,
      defaultMenuKind: 'food' as const,
      onOpenChange: vi.fn(),
      ...overrides,
    };
    render(<MenuDialog {...props} />);
    return props;
  }

  it('@smoke stays closed without a mode', () => {
    renderMenuDialog({ mode: null });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('@contract @a11y creating a menu saves the typed name and closes', async () => {
    const user = userEvent.setup();
    const props = renderMenuDialog();

    expect(screen.getByRole('dialog', { name: 'Create menu' })).toBeInTheDocument();

    const [nameInput] = screen.getAllByRole('textbox');
    await user.type(nameInput, 'Sunday Lunch');
    await user.click(screen.getByRole('button', { name: 'Save menu' }));

    await waitFor(() => expect(hooks.createMenu.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = hooks.createMenu.mutateAsync.mock.calls[0][0];
    expect(payload.labels[0].displayName).toBe('Sunday Lunch');
    expect(payload.menuKind).toBe('food');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract editing prefills the menu and routes through update', async () => {
    const user = userEvent.setup();
    renderMenuDialog({ mode: 'edit', menu: makeMenu() });

    expect(screen.getByRole('dialog', { name: 'Edit menu' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dinner Menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save menu' }));

    await waitFor(() => expect(hooks.updateMenu.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.createMenu.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract shows pending state and errors', () => {
    hooks.createMenu = mutationStub({ isPending: true, error: new Error('Menu rejected') });
    renderMenuDialog();

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByText('Menu rejected')).toBeInTheDocument();
  });
});

describe('SectionDialog', () => {
  function renderSectionDialog(overrides: Partial<Parameters<typeof SectionDialog>[0]> = {}) {
    const props = {
      restaurantId: 'rest-1',
      menu: makeMenu(),
      mode: 'create' as const,
      section: null,
      onOpenChange: vi.fn(),
      ...overrides,
    };
    render(<SectionDialog {...props} />);
    return props;
  }

  it('@contract creating a section appends at the end of the menu', async () => {
    const user = userEvent.setup();
    const props = renderSectionDialog();

    expect(screen.getByRole('dialog', { name: 'Create section' })).toBeInTheDocument();

    const [nameInput] = screen.getAllByRole('textbox');
    await user.type(nameInput, 'Desserts');
    await user.click(screen.getByRole('button', { name: 'Create section' }));

    await waitFor(() => expect(hooks.createSection.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = hooks.createSection.mutateAsync.mock.calls[0][0];
    expect(payload.labels[0].displayName).toBe('Desserts');
    expect(payload.displayOrder).toBe(1);
    expect(payload.legacyCategory).toBe('Desserts');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract editing keeps the existing display order and uses update', async () => {
    const user = userEvent.setup();
    renderSectionDialog({ mode: 'edit', section: makeSection({ displayOrder: 4 }) });

    expect(screen.getByDisplayValue('Starters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save section' }));

    await waitFor(() => expect(hooks.updateSection.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.updateSection.mutateAsync.mock.calls[0][0].displayOrder).toBe(4);
    expect(hooks.createSection.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract disables submit without a parent menu', () => {
    renderSectionDialog({ menu: null });

    expect(screen.getByRole('button', { name: 'Create section' })).toBeDisabled();
  });
});
