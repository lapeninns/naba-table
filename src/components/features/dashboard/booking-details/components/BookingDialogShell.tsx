'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type BookingDialogShellProps = {
  isMobile: boolean;
  open: boolean;
  titleText: string;
  descriptionText: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

export function BookingDialogShell({
  isMobile,
  open,
  titleText,
  descriptionText,
  children,
  onOpenChange,
}: BookingDialogShellProps) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            'h-[94dvh] max-h-[calc(100dvh-var(--safe-area-inset-top))] p-0 gap-0 overflow-hidden border-x-0 border-b-0 [&>button]:hidden',
            'rounded-t-[2.5rem] bg-background/80 shadow-2xl backdrop-blur-3xl',
          )}
        >
          <SheetTitle className="sr-only">{titleText}</SheetTitle>
          <SheetDescription className="sr-only">{descriptionText}</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,900px)] w-[min(98vw,1280px)] max-w-none flex-col overflow-hidden rounded-[2rem] border border-border/20 bg-background p-0 shadow-2xl sm:w-[min(96vw,1280px)] md:h-[min(88vh,900px)] md:w-[min(94vw,1280px)] [&>button]:hidden">
        <DialogTitle className="sr-only">{titleText}</DialogTitle>
        <DialogDescription className="sr-only">{descriptionText}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export type BookingDialogLayoutProps = {
  headerTone: string;
  header: ReactNode;
  body: ReactNode;
  actionRail: ReactNode;
};

export function BookingDialogLayout({
  headerTone,
  header,
  body,
  actionRail,
}: BookingDialogLayoutProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/80 backdrop-blur-xl relative group">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden hidden md:block motion-reduce:hidden">
        <div className="absolute top-[-10%] left-[-10%] size-[40%] bg-primary/10 rounded-full blur-[120px] transition-transform duration-1000 group-hover:scale-110" />
        <div className="absolute bottom-[-10%] right-[-10%] size-[50%] bg-primary/5 rounded-full blur-[140px] transition-transform duration-1000 group-hover:scale-105" />
      </div>

      <div
        className={cn(
          'shrink-0 border-b border-border/40 px-4 py-4 sm:px-6 sm:py-5 z-10 bg-background/40 backdrop-blur-md',
          headerTone,
        )}
      >
        {header}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden z-10">{body}</div>
      {actionRail}
    </div>
  );
}

export default BookingDialogShell;
