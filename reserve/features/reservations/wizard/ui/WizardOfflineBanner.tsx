'use client';

import { WifiOff } from 'lucide-react';
import React, { forwardRef } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';

export type WizardOfflineBannerProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
};

export const WizardOfflineBanner = forwardRef<HTMLDivElement, WizardOfflineBannerProps>(
  (
    {
      title = 'You’re offline',
      description = 'We’ll keep your selections safe, but confirmation actions are disabled until you reconnect.',
      action,
    },
    ref,
  ) => {
    const titleId = React.useId();
    const descriptionId = React.useId();

    return (
      <Alert
        ref={ref}
        variant="warning"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="pg-panel grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-warning/50 bg-warning/10 px-4 py-3 shadow-[var(--pg-shadow-xs)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
      >
        <AlertIcon>
          <WifiOff className="size-5" aria-hidden />
        </AlertIcon>
        <div className="min-w-0">
          <AlertTitle id={titleId}>{title}</AlertTitle>
          <AlertDescription id={descriptionId} className="text-pretty leading-relaxed">
            {description}
          </AlertDescription>
        </div>
        {action ? (
          <div
            data-wizard-offline-action
            className="col-start-2 flex min-w-0 flex-wrap gap-2 [&>*]:min-h-11 sm:col-start-3 sm:row-start-1 sm:justify-end"
          >
            {action}
          </div>
        ) : null}
      </Alert>
    );
  },
);

WizardOfflineBanner.displayName = 'WizardOfflineBanner';

export default WizardOfflineBanner;
