'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateRestaurant } from '@/hooks/ops/useUpdateRestaurant';

import { RestaurantDetailsForm } from './RestaurantDetailsForm';

import type { RestaurantDTO, UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';

type EditRestaurantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: RestaurantDTO | null;
};

export function EditRestaurantDialog({ open, onOpenChange, restaurant }: EditRestaurantDialogProps) {
  const updateMutation = useUpdateRestaurant();

  const handleSubmit = async (input: UpdateRestaurantInput) => {
    if (!restaurant) return;
    try {
      await updateMutation.mutateAsync({ id: restaurant.id, data: input });
      onOpenChange(false);
    } catch (error) {
      // Presentation handled by mutation hook
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

        <RestaurantDetailsForm
          initialValues={{
            name: restaurant.name,
            slug: restaurant.slug,
            timezone: restaurant.timezone,
            contactEmail: restaurant.contactEmail,
            contactPhone: restaurant.contactPhone,
            address: restaurant.address,
            bookingPolicy: restaurant.bookingPolicy,
            reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
            reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
            reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
          }}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={updateMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
