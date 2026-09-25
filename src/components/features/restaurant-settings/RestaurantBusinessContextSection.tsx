'use client';

import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { DiscoveryEditor } from './discovery/DiscoveryEditor';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { RestaurantSettingsCommandCenter } from './shared/RestaurantSettingsCommandCenter';
import { getSettingsSaveReasonCode } from './shared/settingsSaveSequence';
import { SettingsSectionStates } from './shared/settingsSectionStates';
import { useRestaurantBusinessContextEditor } from './useRestaurantBusinessContextEditor';

import type { ReactNode } from 'react';

type RestaurantBusinessContextSectionProps = {
  restaurantId: string | null;
};

function DiscoveryStateFrame({ children }: { children: ReactNode }) {
  const route = RESTAURANT_SETTINGS_ROUTE_MAP.discovery;
  return (
    <RestaurantSettingsCommandCenter title={route.title} description={route.description}>
      {children}
    </RestaurantSettingsCommandCenter>
  );
}

/** `/settings/restaurant/discovery`: Discovery details for the selected restaurant. */
export function RestaurantBusinessContextSection({
  restaurantId,
}: RestaurantBusinessContextSectionProps) {
  const editor = useRestaurantBusinessContextEditor({ restaurantId });
  const { contextQuery } = editor;

  return (
    <SettingsSectionStates
      restaurantId={restaurantId}
      isLoading={contextQuery.isLoading && !contextQuery.data}
      // A failed background refresh keeps the loaded page and its unsaved edits.
      error={contextQuery.data ? null : contextQuery.error}
      noRestaurant={
        <DiscoveryStateFrame>
          <p className="text-sm text-muted-foreground">
            Choose a restaurant with the switcher in the sidebar to manage its discovery details.
          </p>
        </DiscoveryStateFrame>
      }
      loading={
        <DiscoveryStateFrame>
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label="Loading discovery details"
          >
            <Skeleton className="h-9 w-full max-w-xl" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DiscoveryStateFrame>
      }
      errorState={(loadError) => (
        <DiscoveryStateFrame>
          <Alert variant="destructive" role="alert">
            <AlertTriangle aria-hidden />
            <AlertTitle>Discovery details didn’t load</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Saved settings are unchanged. Reason code{' '}
                <span className="font-mono">{getSettingsSaveReasonCode(loadError)}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void contextQuery.refetch()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </DiscoveryStateFrame>
      )}
    >
      {(selectedRestaurantId) => (
        <DiscoveryEditor restaurantId={selectedRestaurantId} editor={editor} />
      )}
    </SettingsSectionStates>
  );
}
