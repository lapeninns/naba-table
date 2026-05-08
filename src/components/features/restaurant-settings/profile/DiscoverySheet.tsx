'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import type { ReactNode } from 'react';

type DiscoverySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function DiscoverySheet({ open, onOpenChange, children }: DiscoverySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Discovery details</SheetTitle>
          <SheetDescription>
            Optional public profile details. Each panel keeps its own save and reset controls.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-5 py-5">
            <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-3">
              <p>
                <span className="font-medium text-foreground">Operator fields first.</span> Saved
                values stay above provider metadata.
              </p>
              <p>
                <span className="font-medium text-foreground">Separate save scopes.</span> Each
                panel saves only its own discovery family.
              </p>
              <p>
                <span className="font-medium text-foreground">Google is optional.</span> Use it when
                comparison or import helps.
              </p>
            </div>
            {children}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
