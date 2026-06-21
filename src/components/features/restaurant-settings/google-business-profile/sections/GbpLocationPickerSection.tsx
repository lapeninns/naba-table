import { LocationPickerCard } from '../components/LocationPickerCard';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

type GbpLocationPickerSectionProps = {
  data: GoogleBusinessProfileConnection;
  selectedLocation: GoogleBusinessProfileAvailableLocation | null;
  selectedLocationValue: string;
  onSelectedLocationValueChange: (value: string) => void;
  onConnect: () => void;
  isConnecting: boolean;
  onLinkLocation: () => void;
  isLinking: boolean;
  hasLinkedLocation: boolean;
  locationsErrorMessage: string | null;
  onRetryLocations: () => void;
  isRetryingLocations: boolean;
  locationsArePossiblyStale: boolean;
};

export function GbpLocationPickerSection({
  data,
  selectedLocation,
  selectedLocationValue,
  onSelectedLocationValueChange,
  onConnect,
  isConnecting,
  onLinkLocation,
  isLinking,
  hasLinkedLocation,
  locationsErrorMessage,
  onRetryLocations,
  isRetryingLocations,
  locationsArePossiblyStale,
}: GbpLocationPickerSectionProps) {
  return (
    <div id="gbp-location" className="scroll-mt-24">
      <LocationPickerCard
        data={data}
        onConnect={onConnect}
        isConnecting={isConnecting}
        selectedLocation={selectedLocation}
        selectedLocationValue={selectedLocationValue}
        onSelectedLocationValueChange={onSelectedLocationValueChange}
        onLinkLocation={onLinkLocation}
        isLinking={isLinking}
        hasLinkedLocation={hasLinkedLocation}
        locationsErrorMessage={locationsErrorMessage}
        onRetryLocations={onRetryLocations}
        isRetryingLocations={isRetryingLocations}
        locationsArePossiblyStale={locationsArePossiblyStale}
      />
    </div>
  );
}
