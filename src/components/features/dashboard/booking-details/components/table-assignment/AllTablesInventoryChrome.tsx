import { Clock, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AllTablesInventoryShellProps = {
  children: React.ReactNode;
};

type AllTablesInventoryHeaderProps = {
  totalCount: number;
  className?: string;
};

type AllTablesConflictBadgeProps = {
  count: number;
};

export function AllTablesInventoryShell({ children }: AllTablesInventoryShellProps) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
      {children}
    </section>
  );
}

export function AllTablesInventoryHeader({ className, totalCount }: AllTablesInventoryHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border/60 pb-2.5',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-semibold text-foreground">Full Inventory</span>
      </div>
      <span className="text-xs text-muted-foreground">{totalCount} tables</span>
    </div>
  );
}

export function AllTablesEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4 text-sm text-muted-foreground">
        No tables match the current filters. Try widening the fit or availability filters.
      </CardContent>
    </Card>
  );
}

export function AllTablesConflictBadge({ count }: AllTablesConflictBadgeProps) {
  if (count <= 0) return null;

  return (
    <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
      <Clock className="size-3" aria-hidden />
      {count} conflict{count > 1 ? 's' : ''}
    </Badge>
  );
}
