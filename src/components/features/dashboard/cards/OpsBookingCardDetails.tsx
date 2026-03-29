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

import type { ElementType, ReactNode } from 'react';
import type { OpsBookingCardDetailsViewModel } from './opsBookingCardUtils';

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
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {label}
    </div>
    <div className="text-[13px] leading-snug">{children}</div>
  </div>
);

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type OpsBookingCardDetailsProps = {
  details: OpsBookingCardDetailsViewModel;
};

export const OpsBookingCardDetails = memo(function OpsBookingCardDetails({
  details,
}: OpsBookingCardDetailsProps) {
  const normalizedTableLabel = normalizeText(tableLabel);
  const normalizedNotes = normalizeText(notes);
  const normalizedPhone = normalizeText(customerPhone);
  const normalizedEmail = normalizeText(customerEmail);

  const content = (
    <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2 lg:grid-cols-4">
      <InfoTile label="Table" icon={Armchair}>
        {normalizedTableLabel ? (
          <span className="font-semibold text-foreground">Table {normalizedTableLabel}</span>
        ) : isDone ? (
          <span className="italic text-muted-foreground">N/A</span>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {table.label}
          </span>
        )}
      </InfoTile>

      <InfoTile label={contact.label} icon={Mail}>
        <div className="flex flex-col gap-1 overflow-hidden leading-tight">
          {normalizedPhone ? (
            <span className="flex items-center gap-1 break-words text-xs font-semibold text-foreground/80">
              <Phone className="h-2.5 w-2.5 shrink-0" aria-hidden /> {normalizedPhone}
            </span>
          ) : null}
          {normalizedEmail ? (
            <span
              className="break-all text-xs italic leading-[1.1] text-muted-foreground/70"
              title={normalizedEmail}
            >
              {normalizedEmail}
            </span>
          ) : null}
          {!normalizedPhone && !normalizedEmail ? (
            <span className="text-xs italic text-muted-foreground">No contact</span>
          ) : null}
        </div>
      </InfoTile>

      <InfoTile label={reference.label} icon={Users}>
        <div className="flex flex-col">
          <span className="font-mono text-xs text-muted-foreground">{reference.valueLabel}</span>
        </div>
      </InfoTile>

      <InfoTile
        label={notes.label}
        icon={FileText}
        className={cn(normalizedNotes && 'border-amber-200/70 bg-amber-50/40')}
      >
        <p className="break-words text-xs italic text-muted-foreground">
          {normalizedNotes || 'No special requests.'}
        </p>
      </InfoTile>
    </div>
  );

  return (
    <CollapsibleContent
      forceMount
      id={`ops-booking-details-${bookingId}`}
      className="px-4 data-[state=closed]:hidden sm:block sm:data-[state=closed]:block"
    >
      {content}
    </CollapsibleContent>
  );
});

OpsBookingCardDetails.displayName = 'OpsBookingCardDetails';
