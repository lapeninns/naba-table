'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateRestaurant } from '@/hooks/ops/useUpdateRestaurant';
import type { RestaurantDTO, UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import { cn } from '@/lib/utils';

type EditRestaurantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: RestaurantDTO | null;
};

type FormData = {
  name: string;
  slug: string;
  timezone: string;
  capacity: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  bookingPolicy: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const COMMON_TIMEZONES = [
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Europe/Paris',
  'Europe/Berlin',
];

export function EditRestaurantDialog({ open, onOpenChange, restaurant }: EditRestaurantDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    timezone: 'Europe/London',
    capacity: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    bookingPolicy: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateMutation = useUpdateRestaurant();

  useEffect(() => {
    if (open && restaurant) {
      setFormData({
        name: restaurant.name,
        slug: restaurant.slug,
        timezone: restaurant.timezone,
        capacity: restaurant.capacity ? String(restaurant.capacity) : '',
        contactEmail: restaurant.contactEmail || '',
        contactPhone: restaurant.contactPhone || '',
        address: restaurant.address || '',
        bookingPolicy: restaurant.bookingPolicy || '',
      });
      setErrors({});
    }
  }, [open, restaurant]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Restaurant name is required';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(formData.slug)) {
      newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }

    if (!formData.timezone.trim()) {
      newErrors.timezone = 'Timezone is required';
    }

    if (formData.capacity && Number.isNaN(Number(formData.capacity))) {
      newErrors.capacity = 'Capacity must be a number';
    }

    if (formData.capacity && Number(formData.capacity) <= 0) {
      newErrors.capacity = 'Capacity must be positive';
    }

    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Invalid email format';
    }

    if (formData.contactPhone && formData.contactPhone.trim().length < 5) {
      newErrors.contactPhone = 'Phone number must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!restaurant || !validate()) {
      return;
    }

    const input: UpdateRestaurantInput = {
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      timezone: formData.timezone.trim(),
      capacity: formData.capacity ? Number(formData.capacity) : null,
      contactEmail: formData.contactEmail.trim() || null,
      contactPhone: formData.contactPhone.trim() || null,
      address: formData.address.trim() || null,
      bookingPolicy: formData.bookingPolicy.trim() || null,
    };

    try {
      await updateMutation.mutateAsync({ id: restaurant.id, data: input });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done by the hook
    }
  };

  if (!restaurant) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Restaurant</DialogTitle>
          <DialogDescription>Update restaurant information. All fields marked with * are required.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-restaurant-name">
                Restaurant Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-restaurant-name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'edit-restaurant-name-error' : undefined}
                className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/60')}
                autoFocus
              />
              {errors.name && (
                <p id="edit-restaurant-name-error" className="text-xs text-destructive" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-restaurant-slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-restaurant-slug"
                value={formData.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={errors.slug ? 'edit-restaurant-slug-error' : undefined}
                className={cn(errors.slug && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.slug && (
                <p id="edit-restaurant-slug-error" className="text-xs text-destructive" role="alert">
                  {errors.slug}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-restaurant-timezone">
                Timezone <span className="text-destructive">*</span>
              </Label>
              <select
                id="edit-restaurant-timezone"
                value={formData.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className={cn(
                  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  errors.timezone && 'border-destructive focus-visible:ring-destructive/60',
                )}
                aria-invalid={Boolean(errors.timezone)}
                aria-describedby={errors.timezone ? 'edit-restaurant-timezone-error' : undefined}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              {errors.timezone && (
                <p id="edit-restaurant-timezone-error" className="text-xs text-destructive" role="alert">
                  {errors.timezone}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-restaurant-capacity">Capacity</Label>
              <Input
                id="edit-restaurant-capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => handleChange('capacity', e.target.value)}
                aria-invalid={Boolean(errors.capacity)}
                aria-describedby={errors.capacity ? 'edit-restaurant-capacity-error' : undefined}
                className={cn(errors.capacity && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.capacity && (
                <p id="edit-restaurant-capacity-error" className="text-xs text-destructive" role="alert">
                  {errors.capacity}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-restaurant-email">Contact Email</Label>
              <Input
                id="edit-restaurant-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                aria-invalid={Boolean(errors.contactEmail)}
                aria-describedby={errors.contactEmail ? 'edit-restaurant-email-error' : undefined}
                className={cn(errors.contactEmail && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.contactEmail && (
                <p id="edit-restaurant-email-error" className="text-xs text-destructive" role="alert">
                  {errors.contactEmail}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-restaurant-phone">Contact Phone</Label>
              <Input
                id="edit-restaurant-phone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                aria-invalid={Boolean(errors.contactPhone)}
                aria-describedby={errors.contactPhone ? 'edit-restaurant-phone-error' : undefined}
                className={cn(errors.contactPhone && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.contactPhone && (
                <p id="edit-restaurant-phone-error" className="text-xs text-destructive" role="alert">
                  {errors.contactPhone}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-restaurant-address">Address</Label>
              <Input
                id="edit-restaurant-address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-restaurant-policy">Booking Policy</Label>
              <Textarea
                id="edit-restaurant-policy"
                value={formData.bookingPolicy}
                onChange={(e) => handleChange('bookingPolicy', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
