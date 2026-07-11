import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryClassificationFields } from '@/components/features/tables/TableInventoryClassificationFields';

import type { TableInventory } from '@/services/ops/tables';

type FieldProps = Parameters<typeof TableInventoryClassificationFields>[0];

function makeProps(overrides: Partial<FieldProps> = {}): FieldProps {
  return {
    category: 'dining',
    isFirstTable: false,
    mobility: 'movable',
    seatingType: 'standard',
    setCategory: vi.fn(),
    setMobility: vi.fn(),
    setSeatingType: vi.fn(),
    setStatus: vi.fn(),
    status: 'available',
    table: null,
    ...overrides,
  };
}

async function expandSection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Classification & service notes/ }));
}

describe('TableInventoryClassificationFields', () => {
  it('@contract keeps the advanced fields collapsed until the trigger is expanded', async () => {
    const user = userEvent.setup();
    render(<TableInventoryClassificationFields {...makeProps()} />);

    expect(screen.queryByLabelText('Section')).not.toBeInTheDocument();

    await expandSection(user);

    expect(screen.getByLabelText('Section')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('@contract marks the section optional for the first table only', () => {
    const { rerender } = render(
      <TableInventoryClassificationFields {...makeProps({ isFirstTable: true })} />,
    );
    expect(screen.getByText('Optional')).toBeInTheDocument();

    rerender(<TableInventoryClassificationFields {...makeProps({ isFirstTable: false })} />);
    expect(screen.queryByText('Optional')).not.toBeInTheDocument();
  });

  it('@contract fires the category setter when a new category is chosen', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryClassificationFields {...props} />);

    await expandSection(user);
    await user.click(screen.getByLabelText('Category'));
    await user.click(await screen.findByRole('option', { name: 'Bar' }));

    expect(props.setCategory).toHaveBeenCalledWith('bar');
  });

  it('@contract fires the status setter when a new status is chosen', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryClassificationFields {...props} />);

    await expandSection(user);
    // The status select trigger has no wired id, so target it by its shown value.
    const triggers = screen.getAllByRole('combobox');
    const statusTrigger = triggers.find((el) => el.textContent?.includes('Available'));
    expect(statusTrigger).toBeDefined();
    await user.click(statusTrigger as HTMLElement);
    await user.click(await screen.findByRole('option', { name: 'Out of service' }));

    expect(props.setStatus).toHaveBeenCalledWith('out_of_service');
  });

  it('@contract prefills section and notes from an existing table', async () => {
    const user = userEvent.setup();
    render(
      <TableInventoryClassificationFields
        {...makeProps({
          table: {
            section: 'Patio',
            notes: 'Wobbly leg',
          } as TableInventory,
        })}
      />,
    );

    await expandSection(user);

    expect(screen.getByLabelText('Section')).toHaveValue('Patio');
    expect(screen.getByLabelText('Notes')).toHaveValue('Wobbly leg');
  });
});
