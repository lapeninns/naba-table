'use client';

import { Filter } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { getEmailDeliveryStatusFilterOptions } from '../opsEmailDeliveryFilterDomain';

import type { EmailDeliveryStatus } from '@/types/emailDelivery';

export type OpsEmailDeliveryStatusFilterPopoverProps = {
  onToggleStatus: (status: EmailDeliveryStatus, enabled: boolean) => void;
  statusCounts?: Partial<Record<EmailDeliveryStatus, number>> | null;
  statuses: EmailDeliveryStatus[];
};

export function OpsEmailDeliveryStatusFilterPopover({
  onToggleStatus,
  statusCounts,
  statuses,
}: OpsEmailDeliveryStatusFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Filter by status">
          <Filter data-icon="inline-start" aria-hidden />
          Status
          {statuses.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {statuses.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Filter by status</p>
        <div className="flex flex-col gap-2">
          {getEmailDeliveryStatusFilterOptions().map(({ status, label, toneClass }) => {
            const checked = statuses.includes(status);
            const count = statusCounts?.[status];
            return (
              <Label key={status} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onToggleStatus(status, Boolean(value))}
                  aria-label={label}
                />
                <Badge variant="outline" className={cn('px-1.5 py-0 text-[11px]', toneClass)}>
                  {label}
                </Badge>
                {typeof count === 'number' && (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
