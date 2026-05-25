'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, LogIn, LogOut, RotateCcw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { queryKeys } from '@/lib/query/keys';

import {
  buildBookingDialogDescriptionText,
  buildBookingDialogTitleText,
  getBookingDialogHeaderStatus,
  getBookingDialogHeaderTone,
  resolveBookingDialogActionState,
} from '../bookingDialogDomain';
import { useBookingDialogCopyFeedback } from './useBookingDialogCopyFeedback';
import { useBookingDialogOpenState } from './useBookingDialogOpenState';
import { useBookingDialogTableAssignmentFocus } from './useBookingDialogTableAssignmentFocus';
import {
  calculateCapacityPercent,
  calculateTotalCapacity,
  canCheckIn,
  canMarkNoShow,
  flattenTableAssignments,
  formatBookingDate,
  formatBookingTime,
  getMinutesUntilTime,
} from '../utils';

import type { BookingDialogPrimaryAction } from '../components';
import type { BookingActionType, BookingDialogProps } from '../types';
import type { OpsBookingStatus } from '@/types/ops';

export function useBookingDialogController({
  booking,
  summary,
  allowTableAssignments,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  onCancel,
  onDataRefresh,
  pendingLifecycleAction,
  cancelPending,
  open,
  onOpenChange,
  isToday = true,
}: BookingDialogProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { handleOpenChange, isOpen } = useBookingDialogOpenState({ onOpenChange, open });

  const [pendingAction, setPendingAction] = useState<BookingActionType | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[contenteditable="true"]')) return true;
    return Boolean(target.closest('input, textarea, select'));
  }, []);

  const timezone = summary?.timezone ?? 'UTC';
  const bookingDate = summary?.date ?? null;
  const status: OpsBookingStatus = booking?.status ?? 'pending';

  const formattedDate = bookingDate ? formatBookingDate(bookingDate, timezone) : '--';
  const formattedStartTime = booking
    ? formatBookingTime(booking.startTime, bookingDate, timezone)
    : '--:--';
  const formattedEndTime = booking
    ? formatBookingTime(booking.endTime, bookingDate, timezone)
    : '--:--';

  const titleText = buildBookingDialogTitleText(booking);
  const descriptionText = buildBookingDialogDescriptionText({
    booking,
    formattedDate,
    formattedStartTime,
  });

  const minutesRemaining =
    booking && bookingDate ? getMinutesUntilTime(booking.startTime, bookingDate, timezone) : null;

  const headerStatus = useMemo(
    () => getBookingDialogHeaderStatus({ minutesRemaining, status }),
    [minutesRemaining, status],
  );
  const headerTone = getBookingDialogHeaderTone(headerStatus);

  const assignedTableRows = useMemo(
    () => (booking ? flattenTableAssignments(booking.tableAssignments) : []),
    [booking],
  );
  const totalCapacity = calculateTotalCapacity(assignedTableRows);
  const capacityPercent = booking ? calculateCapacityPercent(totalCapacity, booking.partySize) : 0;

  const actionState = useMemo(
    () =>
      resolveBookingDialogActionState({
        allowTableAssignments,
        assignedTableCount: assignedTableRows.length,
        canCheckInBooking: booking ? canCheckIn(booking.status) : false,
        hasBooking: Boolean(booking),
        hasCancelHandler: Boolean(onCancel),
        hasCheckInHandler: Boolean(onCheckIn),
        hasCheckOutHandler: Boolean(onCheckOut),
        hasMarkNoShowHandler: Boolean(onMarkNoShow && booking && canMarkNoShow(booking.status)),
        hasUndoNoShowHandler: Boolean(onUndoNoShow),
        isToday,
        requiresTableAssignment: Boolean(booking?.requiresTableAssignment),
        status,
      }),
    [
      allowTableAssignments,
      assignedTableRows.length,
      booking,
      isToday,
      onCancel,
      onCheckIn,
      onCheckOut,
      onMarkNoShow,
      onUndoNoShow,
      status,
    ],
  );
  const { canCancel, needsAssignment, shouldShowNoShow } = actionState;
  const {
    handleTableAssignmentOpenChange,
    isTableAssignmentOpen,
    requestTableAssignmentFocus,
    tableAssignmentPrimaryFocusRef,
    tablePanelRef,
  } = useBookingDialogTableAssignmentFocus({ isMobile, isOpen, needsAssignment });
  const { copySummaryStatus, handleCopyReference, handleCopySummary, srStatusMessage } =
    useBookingDialogCopyFeedback({
      assignedTableRows,
      booking,
      formattedDate,
      formattedEndTime,
      formattedStartTime,
      summary,
    });

  const isActionPending = Boolean(pendingLifecycleAction || pendingAction || cancelPending);
  const handleAction = useCallback(
    async (action: BookingActionType) => {
      if (!action) return;
      setPendingAction(action);
      try {
        if (action === 'check-in') {
          await onCheckIn?.();
        } else if (action === 'check-out') {
          await onCheckOut?.();
        } else if (action === 'undo-no-show') {
          await onUndoNoShow?.();
        } else if (action === 'no-show') {
          await onMarkNoShow?.();
        }
        if (booking?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
        }
      } finally {
        setPendingAction(null);
      }
    },
    [booking?.id, onCheckIn, onCheckOut, onMarkNoShow, onUndoNoShow, queryClient],
  );

  const handleCancel = useCallback(async () => {
    if (!onCancel) return;
    try {
      await onCancel();
    } finally {
      setConfirmCancel(false);
    }
  }, [onCancel]);

  const primaryAction: BookingDialogPrimaryAction = useMemo(() => {
    const decision = actionState.primaryAction;
    if (!decision) return null;

    if (decision.id === 'assign-table') {
      return {
        id: decision.id,
        label: decision.label,
        icon: LayoutGrid,
        tone: decision.tone,
        onClick: requestTableAssignmentFocus,
      };
    }

    if (decision.id === 'check-out') {
      return {
        id: decision.id,
        label: decision.label,
        icon: LogOut,
        tone: decision.tone,
        onClick: () => handleAction('check-out'),
      };
    }

    if (decision.id === 'undo-no-show') {
      return {
        id: decision.id,
        label: decision.label,
        icon: RotateCcw,
        tone: decision.tone,
        onClick: () => handleAction('undo-no-show'),
      };
    }

    if (decision.id === 'check-in') {
      return {
        id: decision.id,
        label: decision.label,
        icon: LogIn,
        tone: decision.tone,
        onClick: () => handleAction('check-in'),
      };
    }

    return null;
  }, [actionState.primaryAction, handleAction, requestTableAssignmentFocus]);

  useGlobalShortcuts([
    {
      key: 'enter',
      metaOrCtrl: true,
      enabled: Boolean(isOpen && primaryAction),
      when: () => {
        if (confirmNoShow || confirmCancel) return false;
        if (isEditableTarget(document.activeElement)) return false;
        return true;
      },
      handler: () => {
        if (isOpen && primaryAction) primaryAction.onClick();
      },
    },
  ]);

  const handleAssignmentComplete = useCallback(() => {
    if (!booking?.id) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
    void onDataRefresh?.();
  }, [booking?.id, onDataRefresh, queryClient]);

  return {
    assignedTableRows,
    bookingDate,
    canCancel,
    capacityPercent,
    confirmCancel,
    confirmNoShow,
    copySummaryStatus,
    descriptionText,
    formattedDate,
    formattedStartTime,
    handleAssignmentComplete,
    handleCancel,
    handleCopyReference,
    handleCopySummary,
    handleOpenChange,
    handleTableAssignmentOpenChange,
    headerTone,
    isActionPending,
    isMobile,
    isOpen,
    isTableAssignmentOpen,
    minutesRemaining,
    needsAssignment,
    primaryAction,
    setConfirmCancel,
    setConfirmNoShow,
    shouldShowNoShow,
    srStatusMessage,
    status,
    tableAssignmentPrimaryFocusRef,
    tablePanelRef,
    timezone,
    titleText,
    totalCapacity,
    onConfirmNoShow: () => handleAction('no-show'),
  };
}

export type BookingDialogController = ReturnType<typeof useBookingDialogController>;
