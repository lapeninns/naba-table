'use client';

import { useCallback, useEffect } from 'react';

import { KEYBOARD_SHORTCUTS } from '../constants';

import type { LifecycleActionHandlers } from '../types';
import type { BookingAction } from '@/components/features/booking-state-machine';

type UseKeyboardShortcutsOptions = {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current effective booking status */
  effectiveStatus: string;
  /** Whether a lifecycle action is pending */
  isPending: boolean;
  /** Whether shortcuts help is showing */
  showShortcuts: boolean;
  /** Setter for shortcuts help visibility */
  setShowShortcuts: (show: boolean) => void;
  /** Close the dialog */
  closeDialog: () => void;
  /** Lifecycle action handlers */
  handlers: LifecycleActionHandlers;
};

/**
 * Hook for managing keyboard shortcuts in BookingDetailsDialog
 * Single Responsibility: Keyboard interaction handling only
 */
export function useKeyboardShortcuts({
  isOpen,
  effectiveStatus,
  isPending,
  showShortcuts,
  setShowShortcuts,
  closeDialog,
  handlers,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Ignore if focused on input elements
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Handle Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          closeDialog();
        }
        return;
      }

      // Handle help shortcut
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Don't process other shortcuts while action is pending
      if (isPending) return;

      // Match keyboard shortcuts
      const key = event.key.toLowerCase();
      const matchedShortcut = KEYBOARD_SHORTCUTS.find(
        (shortcut) =>
          shortcut.key === key && shortcut.enabledStatuses.includes(effectiveStatus)
      );

      if (matchedShortcut) {
        event.preventDefault();
        executeAction(matchedShortcut.action, handlers);
      }
    },
    [isOpen, effectiveStatus, isPending, showShortcuts, setShowShortcuts, closeDialog, handlers]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isOpen]);
}

/**
 * Execute the appropriate action based on shortcut
 */
function executeAction(action: BookingAction, handlers: LifecycleActionHandlers): void {
  switch (action) {
    case 'check-in':
      void handlers.handleCheckIn();
      break;
    case 'check-out':
      void handlers.handleCheckOut();
      break;
    case 'no-show':
      void handlers.handleMarkNoShow();
      break;
    case 'undo-no-show':
      void handlers.handleUndoNoShow();
      break;
  }
}
