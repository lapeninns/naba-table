'use client';

import { DiscoveryEditor } from './discovery/DiscoveryEditor';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { RestaurantSettingsCommandCenter } from './shared/RestaurantSettingsCommandCenter';
import { SettingsLoadErrorAlert } from './shared/SettingsLoadErrorAlert';
import { SettingsNoRestaurantState } from './shared/SettingsNoRestaurantState';
import { SettingsRefreshErrorAlert } from './shared/SettingsRefreshErrorAlert';
import { SettingsSectionSkeleton } from './shared/SettingsSectionSkeleton';
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
          <SettingsNoRestaurantState task="manage its discovery details" />
        </DiscoveryStateFrame>
      }
      loading={
        <DiscoveryStateFrame>
          <SettingsSectionSkeleton label="Loading discovery details" purposeLine={false} />
        </DiscoveryStateFrame>
      }
      errorState={(loadError) => (
        <DiscoveryStateFrame>
          <SettingsLoadErrorAlert
            title="Couldn’t load discovery details"
            error={loadError}
            onRetry={() => void contextQuery.refetch()}
          />
        </DiscoveryStateFrame>
      )}
    >
      {(selectedRestaurantId) => (
        <DiscoveryEditor
          restaurantId={selectedRestaurantId}
          editor={editor}
          notice={
            contextQuery.error && contextQuery.data ? (
              <SettingsRefreshErrorAlert
                error={contextQuery.error}
                onRetry={() => void contextQuery.refetch()}
              />
            ) : null
          }
        />
      )}
    </SettingsSectionStates>
  );
}
