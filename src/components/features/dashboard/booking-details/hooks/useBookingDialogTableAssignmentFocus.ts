'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useBookingDialogTableAssignmentFocus({
  isMobile,
  isOpen,
  needsAssignment,
}: {
  isMobile: boolean;
  isOpen: boolean;
  needsAssignment: boolean;
}) {
  const [isTableAssignmentOpen, setIsTableAssignmentOpen] = useState(false);
  const tablePanelRef = useRef<HTMLDivElement | null>(null);
  const tableAssignmentPrimaryFocusRef = useRef<HTMLButtonElement | null>(null);
  const tableAssignmentUserToggledRef = useRef(false);
  const shouldFocusTablePanelRef = useRef(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    // Some non-browser runtimes expose a stub matchMedia that returns undefined.
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  }, []);

  const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

  useEffect(() => {
    if (!isOpen) setIsTableAssignmentOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    if (!needsAssignment) return;
    if (tableAssignmentUserToggledRef.current) return;
    setIsTableAssignmentOpen(true);
  }, [isMobile, isOpen, needsAssignment]);

  useEffect(() => {
    if (!shouldFocusTablePanelRef.current) return;
    if (!isOpen) return;
    if (isMobile && !isTableAssignmentOpen) return;

    shouldFocusTablePanelRef.current = false;

    const panel = tablePanelRef.current;
    if (panel) {
      panel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
    }

    requestAnimationFrame(() => {
      tableAssignmentPrimaryFocusRef.current?.focus();
    });
  }, [isMobile, isOpen, isTableAssignmentOpen, scrollBehavior]);

  const handleTableAssignmentOpenChange = useCallback((nextOpen: boolean) => {
    tableAssignmentUserToggledRef.current = true;
    setIsTableAssignmentOpen(nextOpen);
  }, []);

  const requestTableAssignmentFocus = useCallback(() => {
    shouldFocusTablePanelRef.current = true;
    if (isMobile) {
      setIsTableAssignmentOpen(true);
    }
  }, [isMobile]);

  return {
    handleTableAssignmentOpenChange,
    isTableAssignmentOpen,
    requestTableAssignmentFocus,
    tableAssignmentPrimaryFocusRef,
    tablePanelRef,
  };
}

export type BookingDialogTableAssignmentFocus = ReturnType<
  typeof useBookingDialogTableAssignmentFocus
>;
