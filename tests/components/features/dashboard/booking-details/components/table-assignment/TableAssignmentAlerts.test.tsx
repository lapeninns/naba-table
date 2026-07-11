import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableAssignmentAlerts } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentAlerts';

function makeProps(overrides: Partial<Parameters<typeof TableAssignmentAlerts>[0]> = {}) {
  return {
    applyError: null,
    smartAssignError: null,
    validation: { errors: [], warnings: [] },
    successMessage: null,
    ...overrides,
  };
}

describe('TableAssignmentAlerts', () => {
  it('@contract renders nothing without alerts', () => {
    const { container } = render(<TableAssignmentAlerts {...makeProps()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract renders the success banner', () => {
    render(<TableAssignmentAlerts {...makeProps({ successMessage: 'Tables assigned' })} />);

    expect(screen.getByText('Tables assigned')).toBeInTheDocument();
  });

  it('@contract prefers the apply error over the smart-assign error in the shared slot', () => {
    render(
      <TableAssignmentAlerts
        {...makeProps({ applyError: 'Apply failed', smartAssignError: 'Smart failed' })}
      />,
    );

    expect(screen.getByText('Apply failed')).toBeInTheDocument();
    expect(screen.queryByText('Smart failed')).not.toBeInTheDocument();
  });

  it('@contract lists each validation error and warning', () => {
    render(
      <TableAssignmentAlerts
        {...makeProps({
          validation: {
            errors: ['Capacity too low'],
            warnings: ['Tables span zones', 'Table is fixed'],
          },
        })}
      />,
    );

    expect(screen.getByText('Capacity too low')).toBeInTheDocument();
    expect(screen.getByText('Tables span zones')).toBeInTheDocument();
    expect(screen.getByText('Table is fixed')).toBeInTheDocument();
  });
});
