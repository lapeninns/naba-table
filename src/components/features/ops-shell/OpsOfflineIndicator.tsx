'use client';

import { RefreshCcw, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

type OpsOfflineIndicatorProps = {
  className?: string;
};

export function OpsOfflineIndicator({ className }: OpsOfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Don't show anything until hydration is complete to prevent flash
  if (!isHydrated || isOnline) {
    return null;
  }

  return (
    <Alert
      variant="warning"
      role="status"
      aria-live="polite"
      className={cn('mx-2 mb-3 sm:mx-4 lg:mx-6', className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertIcon>
            <WifiOff className="h-4 w-4" aria-hidden />
          </AlertIcon>
          <div className="space-y-1">
            <AlertTitle className="text-sm font-semibold text-amber-900">
              You are offline
            </AlertTitle>
            <AlertDescription className="text-sm text-amber-900/80">
              Navigation is paused until you reconnect. We will keep showing cached data where
              available.
            </AlertDescription>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            if (!isOnline) return;
            router.refresh();
          }}
        >
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
          Retry
        </Button>
      </div>
    </Alert>
  );
}

export default OpsOfflineIndicator;
