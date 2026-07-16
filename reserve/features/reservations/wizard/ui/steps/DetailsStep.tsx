'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { Form, FormRoot } from '@/components/ui/form';

import { useWizardNavigation, useWizardState } from '../../context/WizardContext';
import { useWizardDependencies } from '../../di';
import { useDetailsStepForm } from '../../hooks/useDetailsStepForm';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardPanel } from '../WizardPanel';
import { WizardStep } from '../WizardStep';
import { DetailsConsentDialog } from './details-step/DetailsConsentDialog';
import { DetailsContactSection } from './details-step/DetailsContactSection';

import type { DetailsStepProps } from './details-step/types';

export function DetailsStep({ mode = 'customer', ...props }: DetailsStepProps) {
  const { analytics } = useWizardDependencies();
  const { goToStep } = useWizardNavigation();
  const contextState = useWizardState();
  const controller = useDetailsStepForm({
    ...props,
    mode,
    onTrack: props.onTrack ?? analytics.track,
  });
  const { form, handleReview, handlers, isContactValid } = controller;
  const isOpsMode = mode === 'ops';
  const restaurantName =
    props.state?.details.restaurantName || contextState?.details.restaurantName || 'the restaurant';
  const description = isOpsMode
    ? 'Add the guest name and the best contact method for booking updates.'
    : 'We’ll send confirmation and any updates to the contact details below.';

  return (
    <StepErrorBoundary
      stepName="Tell us how to reach you"
      onReset={() => {
        goToStep(2);
      }}
    >
      <WizardStep
        step={2}
        title="Tell us how to reach you"
        description={description}
        contentClassName="space-y-5"
      >
        <Form {...form}>
          <FormRoot
            data-slot="details-form"
            className="mx-auto w-full max-w-2xl space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleReview();
            }}
            noValidate
          >
            <Button type="submit" className="hidden" aria-hidden />

            <WizardPanel interactive className="overflow-hidden">
              <DetailsContactSection
                form={form}
                handlers={handlers}
                contactLocks={props.contactLocks}
                isOpsMode={isOpsMode}
              />
            </WizardPanel>

            {!isOpsMode && !isContactValid ? (
              <p className="text-pretty text-sm text-muted-foreground" role="status">
                Complete the required contact fields to review your booking.
              </p>
            ) : null}
          </FormRoot>
          {!isOpsMode ? (
            <DetailsConsentDialog controller={controller} restaurantName={restaurantName} />
          ) : null}
        </Form>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { DetailsStepProps } from './details-step/types';
