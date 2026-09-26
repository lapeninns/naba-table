'use client';

import { useCallback } from 'react';

import { useRegisterOptionalOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';

import { SETTINGS_SAVE_COPY } from './compactSettingsClasses';

/**
 * Protects a settings dialog or inline editor from silently losing edits.
 *
 * - While `isDirty`, the draft is registered with the ops unsaved-changes registry, so
 *   leaving the page, closing the settings shell, or reloading asks first.
 * - `guardOpenChange` wraps a dialog's `onOpenChange`: closing a dirty dialog asks for
 *   confirmation instead of discarding immediately.
 */
export function useSettingsDiscardGuard(
  id: string,
  isDirty: boolean,
  message: string = SETTINGS_SAVE_COPY.discardConfirm,
) {
  useRegisterOptionalOpsUnsavedChanges(id, isDirty, message);

  const confirmDiscard = useCallback(() => {
    if (!isDirty || typeof window === 'undefined') {
      return true;
    }
    return window.confirm(message);
  }, [isDirty, message]);

  const guardOpenChange = useCallback(
    (onOpenChange: (open: boolean) => void) => (open: boolean) => {
      if (!open && !confirmDiscard()) {
        return;
      }
      onOpenChange(open);
    },
    [confirmDiscard],
  );

  return { confirmDiscard, guardOpenChange };
}
