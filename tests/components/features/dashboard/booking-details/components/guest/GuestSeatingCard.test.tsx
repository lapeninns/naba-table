import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestSeatingCard } from '@/components/features/dashboard/booking-details/components/guest/GuestSeatingCard';

import { makeFlattenedTable } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('GuestSeatingCard', () => {
  it('@contract shows the unassigned notice without table rows', () => {
    render(
      <GuestSeatingCard
        assignedTableRows={[]}
        totalCapacity={0}
        capacityPercent={0}
        partySize={4}
      />,
    );

    expect(screen.getByText('No Table Assigned')).toBeInTheDocument();
    expect(screen.queryByText('Utilization')).not.toBeInTheDocument();
  });

  it('@contract lists assigned table badges with the utilization ratio', () => {
    render(
      <GuestSeatingCard
        assignedTableRows={[
          makeFlattenedTable({ id: 't1', tableNumber: 'T1' }),
          makeFlattenedTable({ id: 't2', tableNumber: 'T2' }),
        ]}
        totalCapacity={8}
        capacityPercent={100}
        partySize={8}
        seatingPreference="Window"
      />,
    );

    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('8 / 8 seats')).toBeInTheDocument();
    expect(screen.getByText('Pref: Window')).toBeInTheDocument();
  });

  it('@contract collapses beyond four tables into an overflow badge', () => {
    render(
      <GuestSeatingCard
        assignedTableRows={['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((tableNumber) =>
          makeFlattenedTable({ id: tableNumber, tableNumber }),
        )}
        totalCapacity={24}
        capacityPercent={100}
        partySize={20}
      />,
    );

    expect(screen.getByText('T4')).toBeInTheDocument();
    expect(screen.queryByText('T5')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
