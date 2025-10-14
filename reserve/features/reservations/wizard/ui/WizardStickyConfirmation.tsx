'use client';

import { CalendarDays, Loader2, Plus, Wallet, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/button';
import { Separator } from '@shared/ui/separator';

import { WizardProgress, type WizardStepMeta, type WizardSummary } from './WizardProgress';

export interface WizardStickyConfirmationProps {
  steps: WizardStepMeta[];
  currentStep: number;
  summary: WizardSummary;
  visible?: boolean;
  onClose?: () => void;
  onAddToCalendar?: () => void;
  onAddToWallet?: () => void;
  onStartNew?: () => void;
  // Optional state flags for buttons
  closeDisabled?: boolean;
  calendarDisabled?: boolean;
  walletDisabled?: boolean;
  startNewDisabled?: boolean;
  calendarLoading?: boolean;
  walletLoading?: boolean;
}

/**
 * WizardStickyConfirmation — redesigned sticky confirmation bar
 * - Spacious layout with clear hierarchy
 * - Safe-area padding
 * - Responsive stacking on small screens
 */
export function WizardStickyConfirmation({
  steps,
  currentStep,
  summary,
  visible = true,
  onClose,
  onAddToCalendar,
  onAddToWallet,
  onStartNew,
  closeDisabled,
  calendarDisabled,
  walletDisabled,
  startNewDisabled,
  calendarLoading,
  walletLoading,
}: WizardStickyConfirmationProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] transition-all duration-200 ease-srx-standard sm:px-6 lg:px-10',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
      )}
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-5xl rounded-2xl border border-border bg-card text-card-foreground shadow-card backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <WizardProgress steps={steps} currentStep={currentStep} summary={summary} />

          <Separator className="bg-border" decorative />

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Close */}
            <div className="order-2 flex w-full items-center justify-start gap-2 sm:order-1 sm:w-auto">
              <Button
                variant="ghost"
                size="lg"
                onClick={onClose}
                className="h-12 rounded-full px-4 text-base"
                aria-label="Close confirmation"
                disabled={closeDisabled}
              >
                <X className="h-5 w-5" aria-hidden />
                <span className="truncate">Close confirmation</span>
              </Button>
            </div>

            {/* Middle: Secondary actions */}
            <div className="order-3 flex w-full flex-col items-stretch gap-2 sm:order-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                size="lg"
                onClick={onAddToCalendar}
                className="h-12 rounded-full px-5 text-base"
                disabled={calendarDisabled || calendarLoading}
              >
                {calendarLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <CalendarDays className="h-5 w-5" aria-hidden />
                )}
                <span className="truncate">Add reservation to calendar</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={onAddToWallet}
                className="h-12 rounded-full px-5 text-base"
                disabled={walletDisabled || walletLoading}
              >
                {walletLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Wallet className="h-5 w-5" aria-hidden />
                )}
                <span className="truncate">Add reservation to wallet</span>
              </Button>
            </div>

            {/* Right: Primary CTA */}
            <div className="order-1 flex w-full justify-end sm:order-3 sm:w-auto">
              <Button
                variant="default"
                size="lg"
                onClick={onStartNew}
                className="h-12 rounded-full px-6 text-base"
                disabled={startNewDisabled}
              >
                <Plus className="h-5 w-5" aria-hidden />
                <span className="truncate">Start a new booking</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WizardStickyConfirmation;
