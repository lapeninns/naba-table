'use client';

import { useParams } from 'react-router-dom';

import { ReservationWizard } from '@features/reservations/wizard/ui/ReservationWizard';

type WizardRouteParams = {
  slug?: string;
};

export default function WizardPage() {
  const { slug } = useParams<WizardRouteParams>();
  const normalizedSlug = slug?.trim();
  const initialDetails = normalizedSlug ? { restaurantSlug: normalizedSlug } : undefined;
  const returnPath = '/thank-you';

  return <ReservationWizard initialDetails={initialDetails} returnPath={returnPath} />;
}
