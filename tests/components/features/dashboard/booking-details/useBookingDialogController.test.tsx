import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBookingDialogController } from '@/components/features/dashboard/booking-details/hooks/useBookingDialogController';

import { makeRow, makeSummary } from '../../../../hooks/__helpers__/opsBookingFixtures';

import type { BookingDialogProps } from '@/components/features/dashboard/booking-details/types';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

function setup(overrides: Partial<BookingDialogProps> = {}) {
  const booking = makeRow({
    id: 'b1',
    status: 'confirmed',
    tableAssignments: [],
    requiresTableAssignment: false,
  });
  const props: BookingDialogProps = {
    booking,
    summary: makeSummary([booking]),
    allowTableAssignments: false,
    open: true,
    onOpenChange: vi.fn(),
    ...overrides,
  };
  return renderHook(() => useBookingDialogController(props));
}

describe('useBookingDialogController', () => {
  it('@contract a failing lifecycle handler never escapes as an unhandled rejection', async () => {
    const onMarkNoShow = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = setup({ onMarkNoShow });

    await act(async () => {
      await expect(Promise.resolve(result.current.onConfirmNoShow())).resolves.toBeUndefined();
    });

    expect(onMarkNoShow).toHaveBeenCalledTimes(1);
    expect(result.current.isActionPending).toBe(false);
  });

  it('@contract keeps the cancel confirmation open when the cancel fails, and closes it on success', async () => {
    const onCancel = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = setup({ onCancel });

    act(() => result.current.setConfirmCancel(true));
    await act(async () => {
      await result.current.handleCancel();
    });
    expect(result.current.confirmCancel).toBe(true);

    await act(async () => {
      await result.current.handleCancel();
    });
    expect(result.current.confirmCancel).toBe(false);
  });

  it('@contract a rejected cancel keeps the confirmation open', async () => {
    const onCancel = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = setup({ onCancel });

    act(() => result.current.setConfirmCancel(true));
    await act(async () => {
      await result.current.handleCancel();
    });

    expect(result.current.confirmCancel).toBe(true);
  });
});
