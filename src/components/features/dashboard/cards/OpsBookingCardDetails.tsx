'use client';

import {
  AlertTriangle,
  Armchair,
  FileText,
  Mail,
  Phone,
  Users,
} from 'lucide-react';
import { memo } from 'react';

import { CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { BookingMeta } from './opsBookingCardUtils';
import type { BookingDTO } from '@/hooks/useBookings';
import type { ElementType, ReactNode } from 'react';

const InfoTile = ({
  label,
  children,
  icon: Icon,
  className,
}: {
  label: string;
  children: ReactNode;
  icon?: ElementType;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-2.5',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {label}
    </div>
    <div className="text-[13px] leading-snug">{children}</div>
  </div>
);

export type OpsBookingCardDetailsProps = {
  booking: BookingDTO;
  meta: BookingMeta;
  tableLabel: string | null;
};

export const OpsBookingCardDetails = memo(function OpsBookingCardDetails({
  booking,
  meta,
  tableLabel,
}: OpsBookingCardDetailsProps) {
  const content = (
    <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2 lg:grid-cols-4">
      <InfoTile label="Table" icon={Armchair}>
        {tableLabel ? (
          <span className="font-semibold text-foreground">Table {tableLabel}</span>
        ) : meta.isDone ? (
          <span className="italic text-muted-foreground">N/A</span>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Unassigned
          </span>
        )}
      </InfoTile>

      <InfoTile label="Contact" icon={Mail}>
        <div className="flex flex-col gap-1 overflow-hidden leading-tight">
          {booking.customerPhone ? (
            <span className="flex items-center gap-1 break-words text-[11px] font-semibold text-foreground/80">
              <Phone className="h-2.5 w-2.5 shrink-0" aria-hidden /> {booking.customerPhone}
            </span>
          ) : null}
          {booking.customerEmail ? (
            <span
              className="break-all text-[11px] italic leading-[1.1] text-muted-foreground/70"
              title={booking.customerEmail}
            >
              {booking.customerEmail}
            </span>
          ) : null}
          {!booking.customerPhone && !booking.customerEmail ? (
            <span className="text-xs italic text-muted-foreground">No contact</span>
          ) : null}
        </div>
      </InfoTile>

      <InfoTile label="Booking" icon={Users}>
        <div className="flex flex-col">
          <span className="font-mono text-[11px] text-muted-foreground">
            Ref {booking.reference || booking.id.slice(0, 8)}
          </span>
        </div>
      </InfoTile>

      <InfoTile
        label="Notes"
        icon={FileText}
        className={cn(booking.notes && 'border-amber-200/70 bg-amber-50/40')}
      >
        <p className="break-words text-xs italic text-muted-foreground">
          {booking.notes || 'No special requests.'}
        </p>
      </InfoTile>
    </div>
  );

  return (
    <CollapsibleContent
      forceMount
      className="px-4 data-[state=closed]:hidden sm:block sm:data-[state=closed]:block"
    >
      {content}
    </CollapsibleContent>
  );
});

OpsBookingCardDetails.displayName = 'OpsBookingCardDetails';
