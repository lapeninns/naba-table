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

import { applySetterCalls, makeMenu, makeSection, switchByLabel } from './__fixtures__/menuHierarchy';

describe('MenuDialogFields', () => {
  it('@smoke renders menu fields with kind selector and active switch', () => {
    render(<MenuDialogFields state={menuInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Menu name')).toBeInTheDocument();
    expect(screen.getByText('Kind')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Food');
    expect(screen.getByText('Google cuisines')).toBeInTheDocument();
    expect(switchByLabel('Menu active')).toBeChecked();
  });

  it('@smoke prefills from an existing menu', () => {
    render(<MenuDialogFields state={menuInitialState(makeMenu())} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('Dinner Menu')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Seasonal food menu')).toBeInTheDocument();
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

    const [firstCuisine] = screen.getAllByRole('checkbox');
    await user.click(firstCuisine);

    expect(applySetterCalls(setState, initial).cuisines).toHaveLength(1);
  });
});

describe('SectionDialogFields', () => {
  it('@smoke renders section fields with the active switch on', () => {
    render(<SectionDialogFields state={sectionInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Section name')).toBeInTheDocument();
    expect(screen.getByText('Legacy category')).toBeInTheDocument();
    expect(screen.getByText('Legacy subcategory')).toBeInTheDocument();
    expect(switchByLabel('Section active')).toBeChecked();
  });

  it('@smoke prefills from an existing section', () => {
    render(
      <SectionDialogFields state={sectionInitialState(makeSection())} setState={vi.fn()} />,
    );

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

    await user.click(switchByLabel('Section active'));

    expect(applySetterCalls(setState, initial).active).toBe(false);
  });
});
