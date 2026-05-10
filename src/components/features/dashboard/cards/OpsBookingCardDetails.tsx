'use client';

import { AlertTriangle, Armchair, FileText, Mail, Phone, Users } from 'lucide-react';
import { memo } from 'react';

import { CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { OpsBookingCardDetailsViewModel } from './opsBookingCardUtils';
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
      'flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:p-3',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {label}
    </div>
    <div className="text-[13px] leading-snug text-foreground">{children}</div>
  </div>
);

export type OpsBookingCardDetailsProps = {
  details: OpsBookingCardDetailsViewModel;
};

export const OpsBookingCardDetails = memo(function OpsBookingCardDetails({
  details,
}: OpsBookingCardDetailsProps) {
  const { bookingId, reference, table, contact, notes } = details;

  const content = (
    <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
      <InfoTile label="Table" icon={Armchair}>
        {table.state === 'assigned' ? (
          <span className="font-semibold text-foreground">{table.label}</span>
        ) : table.state === 'done-empty' ? (
          <span className="italic text-muted-foreground">N/A</span>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-warning">
            <AlertTriangle className="size-3.5" aria-hidden /> {table.label}
          </span>
        )}
      </InfoTile>

      <InfoTile label={contact.label} icon={Mail}>
        <div className="flex flex-col gap-1 overflow-hidden leading-tight">
          {contact.phone ? (
            <span className="flex items-center gap-1 break-words text-xs font-semibold text-foreground/80">
              <Phone className="size-2.5 shrink-0" aria-hidden /> {contact.phone}
            </span>
          ) : null}
          {contact.email ? (
            <span
              className="break-all text-xs italic leading-[1.1] text-muted-foreground/70"
              title={contact.email}
            >
              {contact.email}
            </span>
          ) : null}
          {!contact.phone && !contact.email ? (
            <span className="text-xs italic text-muted-foreground">{contact.emptyLabel}</span>
          ) : null}
        </div>
      </InfoTile>

      <InfoTile label={reference.label} icon={Users}>
        <div className="flex flex-col">
          <span className="break-all font-mono text-xs text-muted-foreground">
            {reference.valueLabel}
          </span>
        </div>
      </InfoTile>

      <InfoTile
        label={notes.label}
        icon={FileText}
        className={cn(notes.highlighted && 'border-primary/30 bg-primary/10')}
      >
        <p className="break-words text-xs italic text-muted-foreground">{notes.value}</p>
      </InfoTile>
    </div>
  );

  return (
    <CollapsibleContent
      forceMount
      id={`ops-booking-details-${bookingId}`}
      className="px-3 data-[state=closed]:hidden sm:block sm:px-4 sm:data-[state=closed]:block"
    >
      {content}
    </CollapsibleContent>
  );
});

OpsBookingCardDetails.displayName = 'OpsBookingCardDetails';
