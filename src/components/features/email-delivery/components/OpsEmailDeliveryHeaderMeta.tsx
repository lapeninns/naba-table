'use client';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { OpsEmailDeliveryRestaurantOption } from '../opsEmailDeliveryTypes';

export type OpsEmailDeliveryHeaderMetaProps = {
  availableRestaurants: OpsEmailDeliveryRestaurantOption[];
  restaurantId: string | null;
  currentRestaurantName: string | null;
  timezone: string;
  onRestaurantChange: (restaurantId: string) => void;
};

export function OpsEmailDeliveryHeaderMeta({
  availableRestaurants,
  restaurantId,
  currentRestaurantName,
  timezone,
  onRestaurantChange,
}: OpsEmailDeliveryHeaderMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {availableRestaurants.length > 1 ? (
        <Select value={restaurantId ?? ''} onValueChange={onRestaurantChange}>
          <SelectTrigger className="h-8 w-full sm:w-[240px]" aria-label="Restaurant switcher">
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
        <Badge variant="outline" className="text-xs">
          {currentRestaurantName}
        </Badge>
      ) : null}
      <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
        {timezone}
      </Badge>
    </div>
  );
}
