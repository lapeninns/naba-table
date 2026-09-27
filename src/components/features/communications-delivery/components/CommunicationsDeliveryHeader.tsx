'use client';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { COMMS_CONTROL_HEIGHT_CLASS } from './communicationsDeliveryClasses';

import type { CommunicationsDeliveryRestaurantOption } from '../communicationsDeliveryTypes';

export type CommunicationsDeliveryHeaderProps = {
  availableRestaurants: CommunicationsDeliveryRestaurantOption[];
  restaurantId: string | null;
  currentRestaurantName: string | null;
  timezone: string;
  onRestaurantChange: (restaurantId: string) => void;
};

/**
 * Restaurant + timezone meta shared by every Communications Delivery screen.
 * Several restaurants show the switcher; one shows a badge, as on Guests.
 */
export function CommunicationsDeliveryHeader({
  availableRestaurants,
  restaurantId,
  currentRestaurantName,
  timezone,
  onRestaurantChange,
}: CommunicationsDeliveryHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {availableRestaurants.length > 1 ? (
        <Select value={restaurantId ?? ''} onValueChange={onRestaurantChange}>
          <SelectTrigger
            className={`${COMMS_CONTROL_HEIGHT_CLASS} w-full sm:w-auto sm:min-w-[240px] max-w-full`}
            aria-label="Restaurant switcher"
          >
            <SelectValue placeholder="Select restaurant" />
          </SelectTrigger>
          <SelectContent>
            {availableRestaurants.map((restaurant) => (
              <SelectItem key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : currentRestaurantName ? (
        <Badge variant="secondary" className="font-medium">
          {currentRestaurantName}
        </Badge>
      ) : null}
      <Badge variant="outline" className="font-mono text-xs tabular-nums text-muted-foreground">
        {timezone}
      </Badge>
    </div>
  );
}
