'use client';

import React from 'react';

import { WizardDependenciesProvider, type WizardDependencies } from '../di';
import { BookingWizard } from './BookingWizard';

import type { WizardLayoutSurface } from './WizardLayout';
import type { BookingDetails, BookingWizardMode } from '../model/reducer';

type ReservationWizardProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  layoutElement?: 'main' | 'div';
  layoutSurface?: WizardLayoutSurface;
  returnPath?: string;
  redirectOnSuccess?: boolean;
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
  layoutElement = 'main',
  layoutSurface = 'guest',
  returnPath,
  redirectOnSuccess,
  dependencies,
  navigationClassName,
  className,
  contentClassName,
}: ReservationWizardProps = {}) {
  return (
    <WizardDependenciesProvider value={dependencies}>
      <BookingWizard
        initialDetails={initialDetails}
        mode={mode}
        layoutElement={layoutElement}
        layoutSurface={layoutSurface}
        returnPath={returnPath}
        redirectOnSuccess={redirectOnSuccess}
        navigationClassName={navigationClassName}
        className={className}
        contentClassName={contentClassName}
      />
    </WizardDependenciesProvider>
  );
}

export default ReservationWizard;
