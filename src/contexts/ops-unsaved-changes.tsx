'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type UnsavedChangeEntry = {
  id: string;
  message: string;
};

type OpsUnsavedChangesContextValue = {
  entries: UnsavedChangeEntry[];
  hasUnsavedChanges: boolean;
  setEntry: (id: string, active: boolean, message?: string) => void;
  clearEntry: (id: string) => void;
  confirmNavigation: (overrideMessage?: string) => boolean;
};

const DEFAULT_MESSAGE = 'You have unsaved changes in this workspace. Leave without saving?';

const OpsUnsavedChangesContext = createContext<OpsUnsavedChangesContextValue | null>(null);

export function OpsUnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [entriesById, setEntriesById] = useState<Record<string, UnsavedChangeEntry>>({});

  const setEntry = useCallback((id: string, active: boolean, message?: string) => {
    setEntriesById((current) => {
      if (!active) {
        if (!current[id]) {
          return current;
        }
        const next = { ...current };
        delete next[id];
        return next;
      }

      const nextEntry: UnsavedChangeEntry = {
        id,
        message: message?.trim() || DEFAULT_MESSAGE,
      };

      const previous = current[id];
      if (previous && previous.message === nextEntry.message) {
        return current;
      }

      return {
        ...current,
        [id]: nextEntry,
      };
    });
  }, []);

  const clearEntry = useCallback((id: string) => {
    setEntriesById((current) => {
      if (!current[id]) {
        return current;
      }
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const entries = useMemo(() => Object.values(entriesById), [entriesById]);
  const hasUnsavedChanges = entries.length > 0;

  const confirmNavigation = useCallback(
    (overrideMessage?: string) => {
      if (!hasUnsavedChanges || typeof window === 'undefined') {
        return true;
      }

      if (overrideMessage) {
        return window.confirm(overrideMessage);
      }

      if (entries.length === 1) {
        return window.confirm(entries[0]?.message || DEFAULT_MESSAGE);
      }

      return window.confirm(DEFAULT_MESSAGE);
    },
    [entries, hasUnsavedChanges],
  );

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const value = useMemo<OpsUnsavedChangesContextValue>(
    () => ({
      entries,
      hasUnsavedChanges,
      setEntry,
      clearEntry,
      confirmNavigation,
    }),
    [confirmNavigation, entries, hasUnsavedChanges, setEntry, clearEntry],
  );

  return <OpsUnsavedChangesContext.Provider value={value}>{children}</OpsUnsavedChangesContext.Provider>;
}

export function useOpsUnsavedChanges() {
  const context = useContext(OpsUnsavedChangesContext);
  if (!context) {
    throw new Error('useOpsUnsavedChanges must be used within OpsUnsavedChangesProvider');
  }
  return context;
}

export function useRegisterOpsUnsavedChanges(id: string, isDirty: boolean, message?: string) {
  const { clearEntry, setEntry } = useOpsUnsavedChanges();

  useEffect(() => {
    setEntry(id, isDirty, message);
    return () => clearEntry(id);
  }, [clearEntry, id, isDirty, message, setEntry]);
}
