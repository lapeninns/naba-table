'use client';

import { Search } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';

export function BookingsListEmptyState() {
  return (
    <OpsEmptyState
      title="No bookings found"
      description="Adjust filters to see more results."
      icon={<Search className="size-5" aria-hidden />}
      className="min-h-[180px] bg-muted/30"
    />
  );
}
