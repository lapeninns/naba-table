import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function renderTable() {
  return render(
    <Table className="w-96">
      <TableCaption>Today&apos;s bookings</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Covers</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada</TableCell>
          <TableCell>4</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell>4</TableCell>
        </TableRow>
      </TableFooter>
    </Table>,
  );
}

describe('ui/table', () => {
  it('@smoke @a11y renders a semantic table with caption, headers, and cells', () => {
    renderTable();

    const table = screen.getByRole('table', { name: "Today's bookings" });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(table).getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
    expect(within(table).getByText('Total')).toBeInTheDocument();
  });

  it('@smoke wraps the table in a scroll container and merges classes', () => {
    const { container } = renderTable();

    const table = screen.getByRole('table');
    expect(table).toHaveClass('w-96');
    expect(container.querySelector('.overflow-auto, .overflow-x-auto')).not.toBeNull();
  });
});
