import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { formatAvailabilitySummary, isServiceWindowOccasion } from './availabilityOccasionsModel';
import { describeTurnBands } from './turnBandsDomain';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { TurnBandsPayload } from '@/services/ops/restaurants';

type AvailabilityOccasionsTableProps = {
  occasions: OpsOccasion[];
  turnBands?: TurnBandsPayload;
  onDelete: (occasion: OpsOccasion) => void;
  onEdit: (occasion: OpsOccasion) => void;
  onToggleActive: (occasionKey: string, nextActive: boolean) => void;
};

export function AvailabilityOccasionsTable({
  occasions,
  turnBands,
  onDelete,
  onEdit,
  onToggleActive,
}: AvailabilityOccasionsTableProps) {
  if (occasions.length === 0) {
    return (
      <OpsEmptyState
        title="No booking types configured yet"
        description="Add the booking moments guests can choose from during reservation."
        className="min-h-[180px] bg-muted/20 px-6 py-10"
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">Label</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dining duration</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {occasions.map((occasion) => {
            const isServiceWindow = isServiceWindowOccasion(occasion.key);
            return (
              <TableRow
                key={occasion.key}
                id={`occasion-row-${occasion.key}`}
                className="scroll-mt-28"
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{occasion.label}</span>
                      {isServiceWindow ? (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Service window
                        </Badge>
                      ) : null}
                      {occasion.isBuiltin ? <Badge variant="secondary">Builtin</Badge> : null}
                    </div>
                    <p className="text-xs font-normal text-muted-foreground">
                      {occasion.shortLabel}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatAvailabilitySummary(occasion.availability)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`occasion-${occasion.key}-active`}
                      aria-label={`Toggle ${occasion.label}`}
                      checked={occasion.isActive}
                      onCheckedChange={(checked) => onToggleActive(occasion.key, checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {occasion.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {describeTurnBands(
                    turnBands?.[occasion.key],
                    `${occasion.defaultDurationMinutes} min (default)`,
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(occasion)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={occasion.isBuiltin}
                      onClick={() => onDelete(occasion)}
                      className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
