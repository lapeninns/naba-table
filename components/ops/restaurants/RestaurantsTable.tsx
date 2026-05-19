'use client';

import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { RestaurantDTO } from '@/app/api/ops/restaurants/schema';

type RestaurantsTableProps = {
  restaurants: RestaurantDTO[];
  isLoading: boolean;
  onEdit: (restaurant: RestaurantDTO) => void;
  onDelete: (restaurant: RestaurantDTO) => void;
};

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

function getRoleBadgeVariant(role: RestaurantDTO['role']) {
  switch (role) {
    case 'owner':
      return 'default' as const;
    case 'admin':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

function EmptyState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold text-foreground">No restaurants found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by creating your first restaurant. You&apos;ll be able to manage bookings,
          operating hours, and team members.
        </p>
      </div>
    </div>
  );
}

function RestaurantCard({
  restaurant,
  onEdit,
  onDelete,
}: {
  restaurant: RestaurantDTO;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canEdit = ['owner', 'admin'].includes(restaurant.role);
  const canDelete = restaurant.role === 'owner';

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">{restaurant.name}</h3>
            <p className="truncate text-sm text-muted-foreground">{restaurant.slug}</p>
          </div>
          <Badge variant={getRoleBadgeVariant(restaurant.role)}>{restaurant.role}</Badge>
        </div>

        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Timezone:</span>
            <span className="ml-1 font-medium text-foreground">{restaurant.timezone}</span>
          </div>
          {restaurant.capacity !== null && (
            <div>
              <span className="text-muted-foreground">Capacity:</span>
              <span className="ml-1 font-medium text-foreground">{restaurant.capacity}</span>
            </div>
          )}
          {restaurant.contactEmail && (
            <div>
              <span className="text-muted-foreground">Email:</span>
              <span className="ml-1 text-foreground">{restaurant.contactEmail}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={onEdit} className="flex-1">
              <Pencil className="mr-1.5 size-4" aria-hidden />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1.5 size-4" aria-hidden />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RestaurantsTable({
  restaurants,
  isLoading,
  onEdit,
  onDelete,
}: RestaurantsTableProps) {
  const showSkeleton = isLoading;
  const showEmpty = !isLoading && restaurants.length === 0;

  return (
    <div className="space-y-4">
      {/* Mobile view */}
      <div className="lg:hidden">
        {showSkeleton ? (
          <div className="space-y-3">
            {skeletonRows.map((row) => (
              <div
                key={`skeleton-mobile-${row}`}
                className="rounded-lg border border-border bg-card p-4"
              >
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="mb-3 h-4 w-48" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onEdit={() => onEdit(restaurant)}
                onDelete={() => onDelete(restaurant)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block">
        {showSkeleton ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table className="min-w-full divide-y divide-border" role="grid" aria-busy="true">
              <TableHeader className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <TableRow>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Name
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Slug
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Timezone
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Capacity
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Role
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/70 text-sm">
                {skeletonRows.map((row) => (
                  <TableRow key={`skeleton-desktop-${row}`}>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Skeleton className="ml-auto h-8 w-32" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : showEmpty ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table className="min-w-full divide-y divide-border" role="grid">
              <TableHeader className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <TableRow>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Name
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Slug
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Timezone
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Capacity
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-left">
                    Role
                  </TableHead>
                  <TableHead scope="col" className="px-4 py-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/70 text-sm">
                {restaurants.map((restaurant) => {
                  const canEdit = ['owner', 'admin'].includes(restaurant.role);
                  const canDelete = restaurant.role === 'owner';

                  return (
                    <TableRow key={restaurant.id}>
                      <TableHead
                        scope="row"
                        className="truncate px-4 py-3 font-medium text-foreground"
                      >
                        {restaurant.name}
                      </TableHead>
                      <TableCell className="truncate px-4 py-3 text-muted-foreground">
                        {restaurant.slug}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {restaurant.timezone}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {restaurant.capacity ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant={getRoleBadgeVariant(restaurant.role)}>
                          {restaurant.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(restaurant)}
                              aria-label={`Edit ${restaurant.name}`}
                            >
                              <Pencil className="mr-1.5 size-4" aria-hidden />
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => onDelete(restaurant)}
                              aria-label={`Delete ${restaurant.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
