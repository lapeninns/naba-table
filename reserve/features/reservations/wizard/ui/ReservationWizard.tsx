'use client';

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { WizardDependenciesProvider } from '../di';
import { BookingWizard } from './BookingWizard';

import type { BookingDetails, BookingWizardMode } from '../model/reducer';

type ReservationWizardProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  returnPath?: string;
};

export function ReservationWizard({
  initialDetails,
  mode = 'customer',
  returnPath,
}: ReservationWizardProps = {}) {
  const navigate = useNavigate();
  const normalizedReturnPath = useMemo(() => returnPath ?? '/thank-you', [returnPath]);
  const navigatorDeps = useMemo(
    () => ({
      navigator: {
        push: (path: string) => navigate(path),
        replace: (path: string) => navigate(path, { replace: true }),
        back: () => navigate(-1),
      },
    }),
    [navigate],
  );

  return (
    <WizardDependenciesProvider value={navigatorDeps}>
      <BookingWizard
        initialDetails={initialDetails}
        mode={mode}
        returnPath={normalizedReturnPath}
      />
    </WizardDependenciesProvider>
  );
}

export default ReservationWizard;
