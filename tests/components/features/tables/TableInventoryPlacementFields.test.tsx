import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryPlacementFields } from '@/components/features/tables/TableInventoryPlacementFields';

type PlacementProps = Parameters<typeof TableInventoryPlacementFields>[0];

const zones = [
  { id: 'zone-main', name: 'Main', active: true },
  { id: 'zone-patio', name: 'Patio', active: false },
];

function makeProps(overrides: Partial<PlacementProps> = {}): PlacementProps {
  return {
    active: true,
    isZoneSelectDisabled: false,
    isZonesLoading: false,
    selectedZone: zones[0],
    setActive: vi.fn(),
    setZoneId: vi.fn(),
    zoneId: 'zone-main',
    zones,
    ...overrides,
  };
}

describe('TableInventoryPlacementFields', () => {
  it('@contract @a11y lets the operator pick a zone and fires setZoneId', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryPlacementFields {...props} />);

    await user.click(screen.getByLabelText('Zone'));
    await user.click(await screen.findByRole('option', { name: 'Patio (inactive)' }));

    expect(props.setZoneId).toHaveBeenCalledWith('zone-patio');
  });

  it('@contract disables the zone select when no zones exist', () => {
    render(
      <TableInventoryPlacementFields {...makeProps({ isZoneSelectDisabled: true, zones: [] })} />,
    );
    expect(screen.getByLabelText('Zone')).toBeDisabled();
  });

  it('@contract crashes while zones are loading because the loading label lacks a SelectGroup (KNOWN-ISSUE)', () => {
    // KNOWN-ISSUE: src/components/features/tables/TableInventoryPlacementFields.tsx:53-54
    // renders <SelectLabel>Loading zones...</SelectLabel> directly inside
    // SelectContent, but Radix requires SelectLabel to sit inside a SelectGroup
    // (the empty-zones branch right below does this correctly). Radix renders
    // closed-select content into a hidden fragment, so the whole form crashes
    // whenever the dialog is open while zones are still loading — even though
    // the select never gets opened. Pinning the throw until the product fix
    // wraps the loading label in a SelectGroup.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        render(<TableInventoryPlacementFields {...makeProps({ isZonesLoading: true })} />),
      ).toThrowError('`SelectLabel` must be used within `SelectGroup`');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('@contract warns when the selected zone is inactive', () => {
    const { rerender } = render(
      <TableInventoryPlacementFields
        {...makeProps({ selectedZone: zones[1], zoneId: 'zone-patio' })}
      />,
    );

    expect(
      screen.getByText('Zone is inactive. Reactivate it to bring these tables back into service.'),
    ).toBeInTheDocument();

    rerender(<TableInventoryPlacementFields {...makeProps()} />);
    expect(
      screen.queryByText('Zone is inactive. Reactivate it to bring these tables back into service.'),
    ).not.toBeInTheDocument();
  });

  it('@contract nudges the operator to choose a zone when none is selected', () => {
    render(
      <TableInventoryPlacementFields {...makeProps({ selectedZone: null, zoneId: undefined })} />,
    );

    expect(
      screen.getByText(
        'Choose the service area this table belongs to. Add more zones later if needed.',
      ),
    ).toBeInTheDocument();
  });

  it('@contract @a11y toggles the active switch and mirrors the state in its label', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { rerender } = render(<TableInventoryPlacementFields {...props} />);

    expect(screen.getByText('Active in service')).toBeInTheDocument();

    await user.click(screen.getByRole('switch'));
    expect(props.setActive).toHaveBeenCalledWith(false);

    rerender(<TableInventoryPlacementFields {...makeProps({ active: false })} />);
    expect(screen.getByText('Inactive / decommissioned')).toBeInTheDocument();
  });
});
