import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';

import { SettingsLoadErrorAlert } from '../../shared/SettingsLoadErrorAlert';
import { SettingsNoRestaurantState } from '../../shared/SettingsNoRestaurantState';
import { SettingsSectionSkeleton } from '../../shared/SettingsSectionSkeleton';

type GbpErrorSectionProps = {
  error: Error;
  onRetry: () => void;
};

export function NoRestaurantGbpSection() {
  return <SettingsNoRestaurantState task="manage its Google Business Profile connection" />;
}

export function LoadingGbpSection() {
  return <SettingsSectionSkeleton label="Loading Google Business Profile" purposeLine={false} />;
}

export function ErrorGbpSection({ error, onRetry }: GbpErrorSectionProps) {
  return (
    <SettingsLoadErrorAlert
      title="Couldn’t load Google Business Profile"
      error={error}
      onRetry={onRetry}
    />
  );
}

export function EmptyGbpConnectionSection() {
  return (
    <OpsEmptyState
      title="Connection details unavailable"
      description="Google Business Profile connection details are not available for this restaurant yet. Reload the page to try again."
    />
  );
}
