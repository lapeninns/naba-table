'use client';

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { WizardDependenciesProvider } from '../di';
import { BookingWizard } from './BookingWizard';

export function ReservationWizard() {
  const navigate = useNavigate();
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
      <BookingWizard />
    </WizardDependenciesProvider>
  );
}

export default ReservationWizard;
