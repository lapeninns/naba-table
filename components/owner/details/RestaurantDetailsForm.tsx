'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type RestaurantDetailsFormValue = {
  name: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type RestaurantDetailsFormProps = {
  value: RestaurantDetailsFormValue;
  disabled?: boolean;
  onChange: (next: RestaurantDetailsFormValue) => void;
  onSubmit: () => void;
};

export function RestaurantDetailsForm({ value, disabled = false, onChange, onSubmit }: RestaurantDetailsFormProps) {
  const handleChange = (patch: Partial<RestaurantDetailsFormValue>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-name">Restaurant name</Label>
          <Input
            id="restaurant-name"
            value={value.name}
            onChange={(event) => handleChange({ name: event.target.value })}
            disabled={disabled}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-timezone">Timezone</Label>
          <Input
            id="restaurant-timezone"
            value={value.timezone}
            onChange={(event) => handleChange({ timezone: event.target.value })}
            disabled={disabled}
            required
            placeholder="e.g. Europe/London"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-capacity">Capacity</Label>
          <Input
            id="restaurant-capacity"
            type="number"
            min={0}
            value={value.capacity ?? ''}
            onChange={(event) => {
              const raw = event.target.value;
              handleChange({ capacity: raw === '' ? null : Number(raw) });
            }}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-phone">Contact phone</Label>
          <Input
            id="restaurant-phone"
            value={value.contactPhone ?? ''}
            onChange={(event) => handleChange({ contactPhone: event.target.value })}
            disabled={disabled}
            placeholder="+1 234 567 890"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="restaurant-email">Contact email</Label>
        <Input
          id="restaurant-email"
          type="email"
          value={value.contactEmail ?? ''}
          onChange={(event) => handleChange({ contactEmail: event.target.value })}
          disabled={disabled}
          placeholder="hello@example.com"
        />
      </div>
      <Button type="submit" disabled={disabled} className="touch-manipulation">
        Save details
      </Button>
    </form>
  );
}
