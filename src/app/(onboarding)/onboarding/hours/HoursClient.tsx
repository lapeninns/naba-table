'use client';

import { useRouter } from 'next/navigation';

import { OperatingHoursSection } from '@/components/features/restaurant-settings/OperatingHoursSection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Props = {
  restaurantId: string;
};

export function HoursClient({ restaurantId }: Props) {
  const router = useRouter();

  if (!restaurantId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Missing restaurant</AlertTitle>
        <AlertDescription>Return to the profile step to create your restaurant first.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <OperatingHoursSection restaurantId={restaurantId} />
      <div className="flex justify-end">
        <Button onClick={() => router.push(`/onboarding/services?rid=${restaurantId}`)}>Continue to services</Button>
      </div>
    </div>
  );
}
