'use client';

import { useRef, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Settings dialog frame. Below `sm` it is a full-height sheet; from `sm` a centred dialog up to
 * 86dvh tall. The header and footer stay pinned while the body scrolls.
 */
export const SETTINGS_DIALOG_CONTENT_CLASS =
  'left-0 top-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[86dvh] sm:w-[calc(100%-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border';

const SIZE_CLASS = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** Hook for tests and e2e selectors. */
  testId?: string;
};

export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  testId,
}: SettingsDialogProps) {
  // Dialogs opened from a menu or a row button have no Radix trigger, so remember the element
  // that had focus and return to it on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && typeof document !== 'undefined') {
          returnFocusRef.current = document.activeElement as HTMLElement | null;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={testId}
        className={cn(SETTINGS_DIALOG_CONTENT_CLASS, SIZE_CLASS[size])}
        onOpenAutoFocus={() => {
          if (!returnFocusRef.current && typeof document !== 'undefined') {
            returnFocusRef.current = document.activeElement as HTMLElement | null;
          }
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current;
          returnFocusRef.current = null;
          if (target && document.contains(target)) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-4 pr-16 text-left sm:px-6 sm:pr-20">
          <DialogTitle className="text-base leading-6">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {children}
        </div>
        {footer ? (
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
