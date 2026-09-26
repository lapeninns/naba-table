import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMocks }));

import {
  describeTableInventoryError,
  showTableInventoryErrorToast,
} from '@/components/features/tables/tableInventoryToasts';
import { HttpError } from '@/lib/http/errors';

import type { ReactNode } from 'react';

// Stands in for server text that could echo data back; it must never reach the toast.
const RAW_SERVER_TEXT = 'duplicate key value violates unique constraint for jane@example.com';

function renderedDescription(): HTMLElement {
  const options = toastMocks.error.mock.calls[0]?.[1] as { description: ReactNode };
  const { container } = render(<div>{options.description}</div>);
  return container;
}

describe('table inventory error toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['TABLE_HAS_BOOKINGS', 409, /current or upcoming bookings/],
    ['TABLE_NUMBER_TAKEN', 409, /Another table already uses that number/],
    ['ZONE_NAME_TAKEN', 409, /Another zone already uses that name/],
    ['ZONE_IN_USE', 409, /still has tables/],
    ['MAINTENANCE_CONFLICT', 409, /maintenance window overlaps/],
    ['INSUFFICIENT_ROLE', 403, /Only owners and managers/],
    ['TABLE_NOT_FOUND', 404, /no longer exists/],
  ] as const)('@contract explains %s with fixed copy, not server text', (code, status, copy) => {
    const error = new HttpError({ message: RAW_SERVER_TEXT, status, code });

    showTableInventoryErrorToast('Table wasn’t deleted.', error);

    expect(toastMocks.error).toHaveBeenCalledWith('Table wasn’t deleted.', expect.anything());
    const description = renderedDescription();
    expect(description).toHaveTextContent(copy);
    expect(description).toHaveTextContent(`Reason code ${code}`);
    expect(description).not.toHaveTextContent(RAW_SERVER_TEXT);
  });

  it('@contract never shows a 5xx server message', () => {
    showTableInventoryErrorToast(
      'Zone wasn’t saved.',
      new HttpError({ message: RAW_SERVER_TEXT, status: 500, code: 'INTERNAL_ERROR' }),
    );

    const description = renderedDescription();
    expect(description).toHaveTextContent('Something went wrong on our side. Try again.');
    expect(description).toHaveTextContent('Reason code INTERNAL_ERROR');
    expect(description).not.toHaveTextContent(RAW_SERVER_TEXT);
  });

  it('describes an unknown non-HTTP failure with the fallback copy', () => {
    expect(describeTableInventoryError(new Error(RAW_SERVER_TEXT))).toBe(
      'Something went wrong. Try again.',
    );
  });

  it('keeps the reason code readable in the description', () => {
    showTableInventoryErrorToast(
      'Table wasn’t saved.',
      new HttpError({ message: 'x', status: 409, code: 'TABLE_HAS_BOOKINGS' }),
    );
    renderedDescription();
    expect(screen.getByText('TABLE_HAS_BOOKINGS')).toHaveClass('font-mono');
  });
});
