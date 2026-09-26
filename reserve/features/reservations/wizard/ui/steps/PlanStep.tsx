'use client';

import { AlertTriangle } from 'lucide-react';
import React, { useMemo } from 'react';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { useWizardActions, useWizardState } from '../../context/WizardContext';
import {
  buildFindBookingPath,
  FIND_BOOKING_LINK_LABEL,
  TIMEOUT_EMAIL_GUIDANCE_ALERT,
} from '../../model/timeoutGuidance';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';
import { PlanStepForm } from './plan-step/PlanStepForm';

import type { StepAction } from '../../model/reducer';
import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';
import type { AnalyticsEvent } from '@shared/lib/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function getMinSelectableDate(timezone: string | null | undefined) {
  const now = new Date();

  if (!timezone) {
    now.setHours(0, 0, 0, 0);
    return now;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = Number.parseInt(parts.find((part) => part.type === 'year')?.value ?? '', 10);
    const month = Number.parseInt(parts.find((part) => part.type === 'month')?.value ?? '', 10);
    const day = Number.parseInt(parts.find((part) => part.type === 'day')?.value ?? '', 10);

    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[plan-step] failed to derive timezone-adjusted min date', {
        timezone,
        error,
      });
    }
  }

  now.setHours(0, 0, 0, 0);
  return now;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TITLE = 'Plan your table';
const DESCRIPTION = 'Choose the party size, date, and time before we ask for contact details.';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanStepProps {
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
  planAlert?: string | null;
  initialCalendarMask?: CalendarMask | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PlanStep({
  onActionsChange,
  onTrack,
  planAlert,
  initialCalendarMask,
}: PlanStepProps) {
  const state = useWizardState();
  const actions = useWizardActions();
  const minSelectableDate = useMemo(() => {
    return getMinSelectableDate(state.details.restaurantTimezone);
  }, [state.details.restaurantTimezone]);

  const alertMessage = planAlert ?? state.error;

  return (
    <StepErrorBoundary
      stepName="Plan your visit"
      onReset={() => {
        actions.goToStep(1);
      }}
    >
      <WizardStep step={1} title={TITLE} description={DESCRIPTION}>
        {/* ─────────────────────────────────────────────────────────────
            Alert Message (if any)
        ───────────────────────────────────────────────────────────── */}
        {alertMessage && (
          <Alert variant="destructive" role="alert" className="items-start animate-fade-in">
            <AlertIcon>
              <AlertTriangle className="size-4" aria-hidden />
            </AlertIcon>
            <AlertDescription aria-live="polite">
              {alertMessage === TIMEOUT_EMAIL_GUIDANCE_ALERT ? (
                <>
                  <p>If you received a confirmation email you are all set.</p>
                  <p>
                    No email?{' '}
                    {/* Plain anchor (no next/link): the standalone reserve app has no Next.js router. */}
                    <Button
                      asChild
                      variant="link"
                      className="h-auto p-0 align-baseline font-medium text-inherit underline underline-offset-4"
                    >
                      <a href={buildFindBookingPath(state.details.restaurantSlug)}>
                        {FIND_BOOKING_LINK_LABEL}
                      </a>
                    </Button>
                    , or retry now.
                  </p>
                </>
              ) : (
                alertMessage
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Plan fields retain their reading order at every breakpoint. */}
        <PlanStepForm
          onActionsChange={onActionsChange}
          onTrack={onTrack}
          minDate={minSelectableDate}
          initialCalendarMask={initialCalendarMask}
        />
      </WizardStep>
    </StepErrorBoundary>
  );
}
