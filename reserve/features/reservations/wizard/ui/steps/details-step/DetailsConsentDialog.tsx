'use client';

import { Check, ChevronDown, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

import { DetailsConsentPreferences } from './DetailsConsentPreferences';

import type { DetailsStepController } from './types';

type DetailsConsentDialogProps = {
  controller: DetailsStepController;
  restaurantName: string;
};

type ConsentContentProps = DetailsConsentDialogProps & {
  showPreferences: boolean;
  onShowPreferencesChange: (show: boolean) => void;
};

const includedItems = [
  'Terms & privacy',
  'Booking messages',
  'Save details & occasional updates',
] as const;

function ConsentContent({
  controller,
  restaurantName,
  showPreferences,
  onShowPreferencesChange,
}: ConsentContentProps) {
  if (showPreferences) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 sm:px-5">
          <DetailsConsentPreferences controller={controller} restaurantName={restaurantName} />
          <p className="text-pretty px-1 text-xs text-muted-foreground">
            Read our{' '}
            <a
              href="/privacy"
              className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4"
            >
              privacy notice
            </a>
            .
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-3 border-t border-border/60 bg-background/95 p-4 backdrop-blur sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onShowPreferencesChange(false)}
          >
            Back
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={controller.isSubmitting}
            onClick={controller.handleConfirmConsent}
          >
            Continue with my choices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
      <div className="rounded-xl bg-muted/55 px-4 py-3">
        <ul className="space-y-2">
          {includedItems.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-pretty pl-7.5 text-xs text-muted-foreground">
          Booking messages use WhatsApp when available and your UK phone number is valid.
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="min-h-12 w-full shadow-[var(--guest-shadow-sm)]"
        disabled={controller.isSubmitting}
        onClick={controller.handleAcceptAllAndContinue}
      >
        Accept all &amp; review booking
      </Button>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-2 text-muted-foreground"
          onClick={() => controller.handleConsentOpenChange(false)}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-1 px-2"
          aria-expanded={showPreferences}
          onClick={() => onShowPreferencesChange(true)}
        >
          Choose preferences
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        By continuing, you accept our{' '}
        <a
          href="/privacy"
          className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4"
        >
          privacy notice
        </a>
        .
      </p>
    </div>
  );
}

export function DetailsConsentDialog({ controller, restaurantName }: DetailsConsentDialogProps) {
  const isMobile = useIsMobile();
  const [showPreferences, setShowPreferences] = useState(false);
  const description = 'Accept everything in one tap, or choose your preferences.';
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowPreferences(false);
    }
    controller.handleConsentOpenChange(open);
  };
  const content = (
    <ConsentContent
      controller={controller}
      restaurantName={restaurantName}
      showPreferences={showPreferences}
      onShowPreferencesChange={setShowPreferences}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={controller.consentOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-auto max-h-[88dvh] gap-0 overflow-hidden rounded-t-[1.75rem] border-x-0 border-b-0 p-0"
        >
          <SheetHeader className="shrink-0 px-4 pb-4 pt-5 text-left sm:px-5">
            <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <SheetTitle className="text-xl">One last step</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={controller.consentOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(88dvh,680px)] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-5 pb-4 pt-5 pr-16">
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <DialogTitle className="text-xl">One last step</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
