'use client';

import { WifiOff } from 'lucide-react';
import React, { forwardRef } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';

export type WizardOfflineBannerProps = {
  title?: string;
  description?: string;
};

export const WizardOfflineBanner = forwardRef<HTMLDivElement, WizardOfflineBannerProps>(
  (
    {
      title = 'You’re offline',
      description = 'We’ll keep your selections safe, but confirmation actions are disabled until you reconnect.',
    },
    ref,
  ) => (
    <Alert
      ref={ref}
      variant="warning"
      role="status"
      aria-live="polite"
      tabIndex={-1}
      className="items-start"
    >
      <AlertIcon>
        <WifiOff className="h-5 w-5" aria-hidden />
      </AlertIcon>
      <div className="flex flex-col gap-1">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </div>
    </Alert>
  ),
);

WizardOfflineBanner.displayName = 'WizardOfflineBanner';

export default WizardOfflineBanner;
