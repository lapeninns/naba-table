'use client';

import { X } from 'lucide-react';
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
import { useCreateRestaurant } from '@/hooks/ops/useCreateRestaurant';
import { cn } from '@/lib/utils';

import type { CreateRestaurantInput } from '@/app/api/ops/restaurants/schema';

type CreateRestaurantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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

export function CreateRestaurantDialog({ open, onOpenChange }: CreateRestaurantDialogProps) {
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
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const createMutation = useCreateRestaurant();

  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        slug: '',
        timezone: 'Europe/London',
        capacity: '',
        contactEmail: '',
        contactPhone: '',
        address: '',
        bookingPolicy: '',
      });
      setErrors({});
      setSlugManuallyEdited(false);
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: slugManuallyEdited ? prev.slug : generateSlug(value),
    }));
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setFormData((prev) => ({ ...prev, slug: value }));
    if (errors.slug) {
      setErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

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

    const slug = formData.slug || generateSlug(formData.name);
    if (!slug) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
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

    if (!validate()) {
      return;
    }

    const input: CreateRestaurantInput = {
      name: formData.name.trim(),
      slug: formData.slug || generateSlug(formData.name),
      timezone: formData.timezone.trim(),
      capacity: formData.capacity ? Number(formData.capacity) : null,
      contactEmail: formData.contactEmail.trim() || null,
      contactPhone: formData.contactPhone.trim() || null,
      address: formData.address.trim() || null,
      bookingPolicy: formData.bookingPolicy.trim() || null,
    };

    try {
      await createMutation.mutateAsync(input);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done by the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Restaurant</DialogTitle>
          <DialogDescription>Add a new restaurant to your system. All fields marked with * are required.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="create-restaurant-name">
                Restaurant Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-restaurant-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="The Happy Pub"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'create-restaurant-name-error' : undefined}
                className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/60')}
                autoFocus
              />
              {errors.name && (
                <p id="create-restaurant-name-error" className="text-xs text-destructive" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="create-restaurant-slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-restaurant-slug"
                value={formData.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="the-happy-pub"
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={errors.slug ? 'create-restaurant-slug-error' : undefined}
                className={cn(errors.slug && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.slug && (
                <p id="create-restaurant-slug-error" className="text-xs text-destructive" role="alert">
                  {errors.slug}
                </p>
              )}
              {!errors.slug && (
                <p className="text-xs text-muted-foreground">Auto-generated from name. Can be customized.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-restaurant-timezone">
                Timezone <span className="text-destructive">*</span>
              </Label>
              <select
                id="create-restaurant-timezone"
                value={formData.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className={cn(
                  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  errors.timezone && 'border-destructive focus-visible:ring-destructive/60',
                )}
                aria-invalid={Boolean(errors.timezone)}
                aria-describedby={errors.timezone ? 'create-restaurant-timezone-error' : undefined}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              {errors.timezone && (
                <p id="create-restaurant-timezone-error" className="text-xs text-destructive" role="alert">
                  {errors.timezone}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-restaurant-capacity">Capacity</Label>
              <Input
                id="create-restaurant-capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => handleChange('capacity', e.target.value)}
                placeholder="100"
                aria-invalid={Boolean(errors.capacity)}
                aria-describedby={errors.capacity ? 'create-restaurant-capacity-error' : undefined}
                className={cn(errors.capacity && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.capacity && (
                <p id="create-restaurant-capacity-error" className="text-xs text-destructive" role="alert">
                  {errors.capacity}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-restaurant-email">Contact Email</Label>
              <Input
                id="create-restaurant-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="info@restaurant.com"
                aria-invalid={Boolean(errors.contactEmail)}
                aria-describedby={errors.contactEmail ? 'create-restaurant-email-error' : undefined}
                className={cn(errors.contactEmail && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.contactEmail && (
                <p id="create-restaurant-email-error" className="text-xs text-destructive" role="alert">
                  {errors.contactEmail}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-restaurant-phone">Contact Phone</Label>
              <Input
                id="create-restaurant-phone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder="+1 234 567 890"
                aria-invalid={Boolean(errors.contactPhone)}
                aria-describedby={errors.contactPhone ? 'create-restaurant-phone-error' : undefined}
                className={cn(errors.contactPhone && 'border-destructive focus-visible:ring-destructive/60')}
              />
              {errors.contactPhone && (
                <p id="create-restaurant-phone-error" className="text-xs text-destructive" role="alert">
                  {errors.contactPhone}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="create-restaurant-address">Address</Label>
              <Input
                id="create-restaurant-address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="123 Main Street, City, Country"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="create-restaurant-policy">Booking Policy</Label>
              <Textarea
                id="create-restaurant-policy"
                value={formData.bookingPolicy}
                onChange={(e) => handleChange('bookingPolicy', e.target.value)}
                placeholder="e.g., Cancellations must be made 24 hours in advance."
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Restaurant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
