'use client';

import { useCallback, useState } from 'react';

import type { BookingDetailsTab, BookingDialogState } from '../types';
import type { BookingAction } from '@/components/features/booking-state-machine';

type UseBookingDialogStateOptions = {
  /** External controlled open state */
  open?: boolean;
  /** External controlled open change handler */
  onOpenChange?: (open: boolean) => void;
  /** Whether table assignments are supported (affects tab visibility) */
  supportsTableAssignment?: boolean;
};

/**
 * Hook for managing BookingDetailsDialog state
 * Single Responsibility: Dialog state management only
 */
export function useBookingDialogState({
  open,
  onOpenChange,
  supportsTableAssignment = false,
}: UseBookingDialogStateOptions = {}): BookingDialogState {
  // Internal state for uncontrolled mode
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<BookingDetailsTab>('overview');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [localPendingAction, setLocalPendingAction] = useState<BookingAction | null>(null);

  // Determine if we're in controlled mode
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;

  // Unified setter that works in both modes
  const setIsOpen = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      } else {
        setInternalIsOpen(value);
      }

      // Reset local pending action when dialog closes
      if (!value) {
        setLocalPendingAction(null);
      }
    },
    [isControlled, onOpenChange]
  );

  // Tab setter with validation
  const setActiveTab = useCallback(
    (tab: BookingDetailsTab) => {
      // Prevent switching to tables tab if not supported
      if (tab === 'tables' && !supportsTableAssignment) {
        return;
      }
      setActiveTabState(tab);
    },
    [supportsTableAssignment]
  );

  return {
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,
    showShortcuts,
    setShowShortcuts,
    isHistoryOpen,
    setIsHistoryOpen,
    localPendingAction,
    setLocalPendingAction,
  };
}
