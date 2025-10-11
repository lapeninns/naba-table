'use client';

import { useCallback, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/dashboard/Pagination';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { useRestaurants } from '@/hooks/ops/useRestaurants';
import type { RestaurantDTO } from '@/app/api/ops/restaurants/schema';
import { RestaurantsTable } from './RestaurantsTable';
import { CreateRestaurantDialog } from './CreateRestaurantDialog';
import { EditRestaurantDialog } from './EditRestaurantDialog';
import { DeleteRestaurantDialog } from './DeleteRestaurantDialog';

export function RestaurantsClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<'name' | 'created_at'>('name');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantDTO | null>(null);

  const { data, error, isLoading, isFetching, refetch } = useRestaurants({
    page,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
    search: search || undefined,
    sort,
  });

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleEdit = (restaurant: RestaurantDTO) => {
    setSelectedRestaurant(restaurant);
    setEditDialogOpen(true);
  };

  const handleDelete = (restaurant: RestaurantDTO) => {
    setSelectedRestaurant(restaurant);
    setDeleteDialogOpen(true);
  };

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
    total: 0,
    hasNext: false,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage Restaurants</h2>
          <p className="text-sm text-muted-foreground">
            Create, update, and manage your restaurants in the system.
          </p>
        </div>

        <Button type="button" onClick={() => setCreateDialogOpen(true)} className="sm:self-start">
          <Plus className="mr-1.5 size-4" aria-hidden />
          New Restaurant
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={handleSearchSubmit} className="flex-1 space-y-2">
          <Label htmlFor="restaurants-search" className="text-sm font-medium text-foreground">
            Search
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="restaurants-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by restaurant name..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </div>
        </form>

        <div className="w-full space-y-2 sm:w-48">
          <Label htmlFor="restaurants-sort" className="text-sm font-medium text-foreground">
            Sort by
          </Label>
          <select
            id="restaurants-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as 'name' | 'created_at');
              setPage(1);
            }}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="name">Name (A-Z)</option>
            <option value="created_at">Recently Created</option>
          </select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Unable to load restaurants</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <RestaurantsTable
        restaurants={data?.items ?? []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {pageInfo.total > 0 && (
        <Pagination
          page={pageInfo.page}
          pageSize={pageInfo.pageSize}
          total={pageInfo.total}
          isLoading={isFetching}
          onPageChange={handlePageChange}
        />
      )}

      <CreateRestaurantDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <EditRestaurantDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        restaurant={selectedRestaurant}
      />

      <DeleteRestaurantDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        restaurant={selectedRestaurant}
      />
    </div>
  );
}
