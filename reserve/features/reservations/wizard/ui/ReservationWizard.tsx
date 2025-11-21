'use client';

import React, { useMemo } from 'react';

import { WizardDependenciesProvider, type WizardDependencies } from '../di';
import { BookingWizard } from './BookingWizard';

import type { BookingDetails, BookingWizardMode } from '../model/reducer';

type ReservationWizardProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  returnPath?: string;
  /**
   * Optional dependency overrides (navigation, analytics, etc.). If omitted,
   * defaults are used, which rely on window navigation.
   */
  dependencies?: Partial<WizardDependencies>;
  navigationClassName?: string;
  className?: string;
  contentClassName?: string;
};

export function ReservationWizard({
  initialDetails,
  mode = 'customer',
  returnPath,
  dependencies,
  navigationClassName,
  className,
  contentClassName,
}: ReservationWizardProps = {}) {
  const normalizedReturnPath = useMemo(() => returnPath ?? '/thank-you', [returnPath]);

  return (
    <WizardDependenciesProvider value={dependencies}>
      <BookingWizard
        initialDetails={initialDetails}
        mode={mode}
        returnPath={normalizedReturnPath}
        navigationClassName={navigationClassName}
        className={className}
        contentClassName={contentClassName}
      />
    </WizardDependenciesProvider>
  );
}

export default ReservationWizard;
