'use client';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { RestaurantOption } from './types';

type RestaurantSelectorProps = {
  restaurants: RestaurantOption[];
  value: string | null;
  onChange: (restaurantId: string) => void;
};

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'owner':
      return 'default' as const;
    case 'admin':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

export function RestaurantSelector({ restaurants, value, onChange }: RestaurantSelectorProps) {
  const selectedRestaurant = restaurants.find((r) => r.id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor="restaurant-selector" className="text-sm font-medium">
        Restaurant
      </Label>
      <div className="flex items-center gap-3">
        <select
          id="restaurant-selector"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {restaurants.length === 0 && <option value="">No restaurants available</option>}
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>
        {selectedRestaurant && <Badge variant={getRoleBadgeVariant(selectedRestaurant.role)}>{selectedRestaurant.role}</Badge>}
      </div>
    </div>
  );
}
