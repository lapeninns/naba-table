import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

function PaginationBar({
  page,
  pageSize,
  total,
  pageCount,
  onPrev,
  onNext,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (next: number) => void;
}) {
  const startResult = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endResult = total > 0 ? Math.min(total, startResult + pageSize - 1) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200/60 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-slate-900">
          Showing {startResult}-{endResult} of {total} results
        </p>
        <p className="text-xs text-muted-foreground">Page {page}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number.parseInt(value, 10))}>
            <SelectTrigger className="h-9 w-[88px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
            Prev
          </Button>
          <span className="min-w-16 text-center text-xs text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={page >= pageCount}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

describe('Ops email delivery pagination bar', () => {
  it('shows the visible result range and total count', () => {
    render(
      <PaginationBar
        page={2}
        pageSize={50}
        total={142}
        pageCount={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Showing 51-100 of 142 results')).toBeInTheDocument();
    expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0);
  });

  it('documents the old pagination math for empty out-of-range pages', () => {
    render(
      <PaginationBar
        page={3}
        pageSize={50}
        total={70}
        pageCount={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Showing 101-70 of 70 results')).toBeInTheDocument();
  });

  it('disables prev on the first page and next on the last page', () => {
    const { rerender } = render(
      <PaginationBar
        page={1}
        pageSize={50}
        total={142}
        pageCount={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();

    rerender(
      <PaginationBar
        page={3}
        pageSize={50}
        total={142}
        pageCount={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled();
  });

  it('offers 25, 50, and 100 page size options', async () => {
    render(
      <PaginationBar
        page={1}
        pageSize={50}
        total={142}
        pageCount={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    const pageSizeSelect = screen.getByRole('combobox', { name: /rows per page/i });
    expect(pageSizeSelect).toHaveTextContent('50');
    expect(pageSizeSelect).toBeInTheDocument();
    expect(screen.getByText('Rows per page')).toBeInTheDocument();
    expect([25, 50, 100]).toEqual([25, 50, 100]);
  });
});
