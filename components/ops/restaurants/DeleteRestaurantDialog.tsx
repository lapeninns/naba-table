'use client';

import { AlertTriangle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteRestaurant } from '@/hooks/ops/useDeleteRestaurant';

import type { RestaurantDTO } from '@/app/api/ops/restaurants/schema';

type DeleteRestaurantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: RestaurantDTO | null;
};

export function DeleteRestaurantDialog({ open, onOpenChange, restaurant }: DeleteRestaurantDialogProps) {
  const deleteMutation = useDeleteRestaurant();

  const handleConfirm = async () => {
    if (!restaurant) return;

    try {
      await deleteMutation.mutateAsync({ id: restaurant.id, name: restaurant.name });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done by the hook
    }
  };

  if (!restaurant) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" aria-hidden />
            </div>
            <AlertDialogTitle>Delete Restaurant?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-3">
            <p>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{restaurant.name}"</span>
              ?
            </p>
            <p>This will permanently delete:</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>All bookings</li>
              <li>All customers</li>
              <li>Operating hours</li>
              <li>Service periods</li>
              <li>Team memberships</li>
              <li>All related data</li>
            </ul>
            <p className="font-semibold text-destructive">This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete Restaurant'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
