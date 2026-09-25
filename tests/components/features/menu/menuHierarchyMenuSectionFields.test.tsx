import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  menuInitialState,
  sectionInitialState,
} from '@/components/features/menu/menuHierarchyDomain';
import {
  MenuDialogFields,
  SectionDialogFields,
} from '@/components/features/menu/menuHierarchyMenuSectionFields';

import {
  applySetterCalls,
  makeMenu,
  makeSection,
  switchByLabel,
} from './__fixtures__/menuHierarchy';

describe('MenuDialogFields', () => {
  it('@smoke keeps essentials visible and advanced fields collapsed', async () => {
    const user = userEvent.setup();
    render(<MenuDialogFields state={menuInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Menu name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Food');
    expect(switchByLabel('Shown to guests')).toBeChecked();
    expect(screen.queryByText('Google cuisines')).not.toBeInTheDocument();
    expect(screen.queryByText('Source URL')).not.toBeInTheDocument();

    const advanced = screen.getByRole('button', { name: /Advanced/ });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await user.click(advanced);
    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Google cuisines')).toBeInTheDocument();
    expect(screen.getByText('Source URL')).toBeInTheDocument();
    expect(screen.getByText('Default language')).toBeInTheDocument();
    expect(screen.getByText('Additional Google labels')).toBeInTheDocument();
  });

  it('@smoke prefills from an existing menu', async () => {
    const user = userEvent.setup();
    render(<MenuDialogFields state={menuInitialState(makeMenu())} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('Dinner Menu')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Seasonal food menu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    expect(screen.getByDisplayValue('en-GB')).toBeInTheDocument();
  });

  it('@contract patches the menu name and menu kind', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = menuInitialState();
    render(<MenuDialogFields state={initial} setState={setState} />);

    const [name] = screen.getAllByRole('textbox');
    await user.type(name, 'D');
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Drinks' }));

    const patched = applySetterCalls(setState, initial);
    expect(patched.displayName).toBe('D');
    expect(patched.menuKind).toBe('drinks');
  });

  it('@contract toggling a cuisine updates the cuisines list', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = menuInitialState();
    render(<MenuDialogFields state={initial} setState={setState} />);

    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    const [firstCuisine] = screen.getAllByRole('checkbox');
    await user.click(firstCuisine);

    expect(applySetterCalls(setState, initial).cuisines).toHaveLength(1);
  });
});

describe('SectionDialogFields', () => {
  it('@smoke renders section essentials with legacy categories under Advanced', async () => {
    const user = userEvent.setup();
    render(<SectionDialogFields state={sectionInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Section name')).toBeInTheDocument();
    expect(switchByLabel('Shown on the menu')).toBeChecked();
    expect(screen.queryByText('Legacy category')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    expect(screen.getByText('Legacy category')).toBeInTheDocument();
    expect(screen.getByText('Legacy subcategory')).toBeInTheDocument();
    expect(screen.getByText('Primary label language')).toBeInTheDocument();
    expect(screen.getByText('Additional Google labels')).toBeInTheDocument();
  });

  it('@smoke prefills from an existing section', () => {
    render(<SectionDialogFields state={sectionInitialState(makeSection())} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('Starters')).toBeInTheDocument();
  });

  it('@contract patches name and legacy category edits', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = sectionInitialState();
    render(<SectionDialogFields state={initial} setState={setState} />);

    const textboxes = screen.getAllByRole('textbox');
    await user.type(textboxes[0], 'S');

    expect(applySetterCalls(setState, initial).displayName).toBe('S');
  });

  it('@contract toggling section active patches the flag', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = sectionInitialState();
    render(<SectionDialogFields state={initial} setState={setState} />);

    await user.click(switchByLabel('Shown on the menu'));

    expect(applySetterCalls(setState, initial).active).toBe(false);
  });
});
