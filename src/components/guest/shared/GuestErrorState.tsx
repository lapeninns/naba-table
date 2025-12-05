import React from 'react';

import { GuestError } from '@/components/guest/ui';

type GuestErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  redirectHref?: string;
  redirectLabel?: string;
};

export function GuestErrorState({
  title = 'Something went wrong',
  description = 'We could not load your data. Please try again.',
  onRetry,
  redirectHref = '/auth/signin',
  redirectLabel = 'Sign in again',
}: GuestErrorStateProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <GuestError
        title={title}
        description={description}
        onRetry={onRetry}
        redirectHref={redirectHref}
        redirectLabel={redirectLabel}
      />
    </div>
  );
}
