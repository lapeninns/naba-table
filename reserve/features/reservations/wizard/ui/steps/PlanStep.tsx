'use client';

import { AlertTriangle } from 'lucide-react';
import React, { useMemo } from 'react';

import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';

import { useWizardActions, useWizardState } from '../../context/WizardContext';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';
import { PlanStepForm } from './plan-step/PlanStepForm';

import type { StepAction } from '../../model/reducer';
import type { AnalyticsEvent } from '@shared/lib/analytics';

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

const TITLE = 'Plan your visit';
const DESCRIPTION =
  'Choose a date, time, party size, and any preferences. We’ll show the best options available.';

export interface PlanStepProps {
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
  planAlert?: string | null;
}

export function PlanStep({ onActionsChange, onTrack, planAlert }: PlanStepProps) {
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
        {alertMessage ? (
          <Alert variant="destructive" role="alert" className="items-start">
            <AlertIcon>
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </AlertIcon>
            <AlertDescription>{alertMessage}</AlertDescription>
          </Alert>
        ) : null}
        <PlanStepForm
          onActionsChange={onActionsChange}
          onTrack={onTrack}
          minDate={minSelectableDate}
        />
      </WizardStep>
    </StepErrorBoundary>
  );
}
