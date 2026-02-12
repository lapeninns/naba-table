'use client';

import { Search } from 'lucide-react';

import { Card } from '@/components/ui/card';

export function BookingsListEmptyState() {
  return (
    <Card className="border-dashed border-border/60 bg-muted/30">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/50">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">No bookings found</p>
          <p className="text-sm text-muted-foreground">Adjust filters to see more results.</p>
        </div>
      </div>
    </Card>
  );
}
