'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useBookingDialogOpenState({
  open,
  onOpenChange,
}: {
  open: boolean | undefined;
  onOpenChange: ((open: boolean) => void) | undefined;
}) {
  const [isOpen, setIsOpen] = useState(Boolean(open));
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [isOpen]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen && wasOpen) {
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) {
        requestAnimationFrame(() => previous.focus());
      }
    }
  }, [isOpen]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setIsOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  return {
    handleOpenChange,
    isOpen,
  };
}

export type BookingDialogOpenState = ReturnType<typeof useBookingDialogOpenState>;
